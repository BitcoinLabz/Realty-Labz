import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

// How long a signed-in session may keep a stale role or teamId before it is
// re-read from the database. See the jwt callback below for why this exists.
const SESSION_REFRESH_MS = 5 * 60 * 1000;

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          teamId: user.teamId,
        };
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // Without this, Google silently reuses whatever Google account is
      // already active in the browser instead of showing the account
      // chooser -- which is exactly the "it keeps logging me into the same
      // account" symptom. This forces the chooser every time, so switching
      // accounts (or signing into a different one after signing out) always
      // works, regardless of the browser's existing Google session.
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  callbacks: {
    signIn: async ({ user, account, profile }) => {
      if (account?.provider !== "google") return true;

      // Google verifies the email address itself, so it's safe to use it to
      // find-or-create/link the account — an unverified email can't reach here.
      if (!user.email || !profile?.email_verified) return false;

      const email = user.email.toLowerCase();
      const dbUser =
        (await prisma.user.findUnique({ where: { email } })) ??
        (await prisma.user.create({
          data: { email, name: user.name ?? "New user", role: "AGENT" },
        }));

      user.id = dbUser.id;
      user.role = dbUser.role;
      user.teamId = dbUser.teamId;
      return true;
    },
    jwt: async ({ token, user, trigger, session: update }) => {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.teamId = user.teamId;
        token.refreshedAt = Date.now();
        return token;
      }

      // unstable_update() from a server action lands here -- used after
      // joining a team so the Team nav appears immediately instead of
      // whenever the throttled refresh below next runs.
      if (trigger === "update" && update) {
        const patch = update as { user?: { role?: typeof token.role; teamId?: string | null } };
        if (patch.user?.role) token.role = patch.user.role;
        if (patch.user?.teamId !== undefined) token.teamId = patch.user.teamId;
        token.refreshedAt = Date.now();
        return token;
      }

      // role and teamId used to be written once at sign-in and never again,
      // and this app's JWTs last 30 days. That meant removing an agent from
      // a brokerage -- or demoting a team lead -- did nothing at all until
      // they happened to sign out and back in, for up to a month.
      //
      // Re-reading on every request would put a database round-trip in front
      // of every single page. Once every REFRESH_MS bounds the staleness to
      // minutes instead of weeks at roughly one indexed primary-key lookup
      // per user per interval. The write persists via proxy.ts, which -- as
      // a proxy rather than a server component -- can actually set cookies.
      if (token.id && Date.now() - (token.refreshedAt ?? 0) > SESSION_REFRESH_MS) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id },
            select: { role: true, teamId: true },
          });
          // A genuinely missing row means the account is gone: end the
          // session rather than honouring a token for a deleted user.
          if (!dbUser) return null;
          token.role = dbUser.role;
          token.teamId = dbUser.teamId;
          token.refreshedAt = Date.now();
        } catch (err) {
          // A transient database problem must not sign the whole app out.
          // Keeping the existing token costs at most one more interval of
          // staleness; failing closed here would be an outage.
          console.error("[auth] session refresh failed, keeping existing token", err);
        }
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.teamId = token.teamId;
      }
      return session;
    },
  },
});
