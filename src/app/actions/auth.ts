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

  if (accountType === "team") {
    const team = await prisma.team.create({ data: { name: teamName! } });
    await prisma.user.create({
      data: { name, email, passwordHash, role: "TEAM_LEAD", teamId: team.id },
    });
  } else {
    await prisma.user.create({
      data: { name, email, passwordHash, role: "AGENT" },
    });
  }

  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  return {};
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
      redirectTo: "/dashboard",
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
