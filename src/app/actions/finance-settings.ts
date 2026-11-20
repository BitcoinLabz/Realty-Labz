"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { taxSettingsSchema } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

export async function updateTaxSettingsAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  // An empty field or "no city tax" choice means "not set" -- each is
  // written back as null below so clearing a value actually clears it.
  const blankToUndefined = (name: string) => {
    const value = formData.get(name);
    return value === "" || value === null ? undefined : value;
  };
  const parsed = taxSettingsSchema.safeParse({
    estimatedIncomeTaxRatePercent: blankToUndefined("estimatedIncomeTaxRatePercent"),
    residenceCity: blankToUndefined("residenceCity"),
    workCity: blankToUndefined("workCity"),
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
    data: {
      estimatedIncomeTaxRatePercent: parsed.data.estimatedIncomeTaxRatePercent ?? null,
      residenceCity: parsed.data.residenceCity ?? null,
      workCity: parsed.data.workCity ?? null,
    },
  });

  revalidatePath("/finances");
  revalidatePath("/finances/taxes");
  revalidatePath("/dashboard");
  return {};
}
