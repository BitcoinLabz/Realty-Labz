import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
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
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.teamId = user.teamId;
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
