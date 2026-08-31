"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { passwordChangeSchema, profileSchema } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

export async function updateProfileAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    licenseNumber: formData.get("licenseNumber") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  // Empty string means "leave it blank", not "store an empty license" -- the
  // column is unique, and a second empty string would collide where a second
  // NULL doesn't.
  const licenseNumber = parsed.data.licenseNumber || null;

  if (licenseNumber) {
    const taken = await prisma.user.findFirst({
      where: { licenseNumber, id: { not: session.user.id } },
      select: { id: true },
    });
    if (taken) {
      return {
        fieldErrors: {
          licenseNumber:
            "That license number is already on another account. If it's yours, get in touch from the support page.",
        },
      };
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name, licenseNumber },
  });

  revalidatePath("/account");
  revalidatePath("/dashboard");
  return {};
}

export async function changePasswordAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return { error: "User not found" };
  if (!user.passwordHash) {
    return { error: "This account signed in with Google and doesn't have a password to change." };
  }

  const isValid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!isValid) {
    return { fieldErrors: { currentPassword: "Current password is incorrect" } };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return {};
}
