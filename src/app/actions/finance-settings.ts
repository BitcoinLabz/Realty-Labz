"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { homeOfficeSettingsSchema, taxSettingsSchema } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

export async function updateHomeOfficeSettingsAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const raw = formData.get("homeOfficeSqFt");
  const parsed = homeOfficeSettingsSchema.safeParse({
    homeOfficeSqFt: raw === "" ? undefined : raw,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    // An empty field explicitly nulls the setting back off (no deduction
    // shown) rather than being silently ignored -- Prisma skips undefined
    // fields on update, so this needs the explicit null, same lesson learned
    // for Loan.currentHomeValue.
    data: { homeOfficeSqFt: parsed.data.homeOfficeSqFt ?? null },
  });

  revalidatePath("/finances");
  revalidatePath("/dashboard");
  return {};
}

export async function updateTaxSettingsAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const raw = formData.get("estimatedIncomeTaxRatePercent");
  const parsed = taxSettingsSchema.safeParse({
    estimatedIncomeTaxRatePercent: raw === "" ? undefined : raw,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { estimatedIncomeTaxRatePercent: parsed.data.estimatedIncomeTaxRatePercent ?? null },
  });

  revalidatePath("/finances");
  return {};
}
