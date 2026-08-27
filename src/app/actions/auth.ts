"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { auth, signIn, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { loginSchema, signupSchema } from "@/lib/validation";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

const TOO_MANY_ATTEMPTS = "Too many attempts — please wait a few minutes and try again.";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  // Optional confirmation message for actions where "it worked" isn't
  // self-evident from the page re-rendering -- e.g. sending an email, where
  // nothing on screen changes. Purely additive: existing call sites that
  // check `!state.error && !state.fieldErrors` are unaffected.
  success?: string;
};

export async function signupAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const ip = await getClientIp();
  if (await isRateLimited(`signup:${ip}`, { max: 5, windowMinutes: 60 })) {
    return { error: TOO_MANY_ATTEMPTS };
  }

  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    accountType: formData.get("accountType"),
    teamName: formData.get("teamName") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { name, email, password, accountType, teamName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { fieldErrors: { email: "An account with this email already exists" } };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // "team" and "brokerage" both create a Team (the tenant), differing only
  // in the creator's role -- and that role is the whole difference: a BROKER
  // can change who is on the roster, a TEAM_LEAD can only see its work.
  // See canManageMembership in src/lib/authorization.ts.
  if (accountType === "team" || accountType === "brokerage") {
    const team = await prisma.team.create({ data: { name: teamName! } });
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: accountType === "brokerage" ? "BROKER" : "TEAM_LEAD",
        teamId: team.id,
      },
    });
  } else {
    await prisma.user.create({
      data: { name, email, passwordHash, role: "AGENT" },
    });
  }

  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  return {};
}

// Where to send someone after a successful login. proxy.ts already appends
// ?callbackUrl= when it bounces an unauthenticated request, and /join/[id]
// uses it so an existing agent lands back on the invite instead of the
// dashboard -- but a redirect target that comes in over the wire has to be
// treated as hostile. Only same-site absolute paths are honoured: anything
// scheme-relative ("//evil.com") or absolute ("https://evil.com") falls back
// to the dashboard rather than handing an attacker a redirect off-site.
function safeRedirectTo(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export async function loginAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const ip = await getClientIp();
  if (await isRateLimited(`login:${ip}`, { max: 10, windowMinutes: 15 })) {
    return { error: TOO_MANY_ATTEMPTS };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeRedirectTo(formData.get("callbackUrl")),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Invalid email or password" };
    }
    throw err;
  }

  return {};
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

export async function googleSignInAction() {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  return session;
}
