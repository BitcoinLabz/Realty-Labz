"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { referralPartnerSchema } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

export async function createReferralPartnerAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const parsed = referralPartnerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  await prisma.referralPartner.create({ data: { userId: session.user.id, ...parsed.data } });

  // Partners are a global (userId-scoped) list surfaced on every deal's own
  // page, not a single dedicated list page -- revalidate whichever deal page
  // the agent was actually on when they added one.
  const returnToDealId = formData.get("returnToDealId");
  if (typeof returnToDealId === "string" && returnToDealId) {
    revalidatePath(`/transactions/${returnToDealId}`);
  }
  return {};
}

export async function deleteReferralPartnerAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  await prisma.referralPartner.deleteMany({ where: { id, userId: session.user.id } });

  const returnToDealId = formData.get("returnToDealId");
  if (typeof returnToDealId === "string" && returnToDealId) {
    revalidatePath(`/transactions/${returnToDealId}`);
  }
}
