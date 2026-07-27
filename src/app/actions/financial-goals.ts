"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { financialGoalSchema } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

function parseGoalForm(formData: FormData) {
  return financialGoalSchema.safeParse({
    name: formData.get("name"),
    targetAmount: formData.get("targetAmount"),
    currentAmount: formData.get("currentAmount") || undefined,
    targetDate: formData.get("targetDate") || undefined,
    linkedAssetId: formData.get("linkedAssetId") || undefined,
  });
}

async function resolveLinkedAssetId(
  linkedAssetId: string | undefined,
  userId: string,
): Promise<{ ok: true; linkedAssetId: string | null } | { ok: false; error: string }> {
  if (!linkedAssetId) return { ok: true, linkedAssetId: null };
  const asset = await prisma.asset.findFirst({ where: { id: linkedAssetId, userId } });
  if (!asset) return { ok: false, error: "Asset not found" };
  return { ok: true, linkedAssetId };
}

export async function createFinancialGoalAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const parsed = parseGoalForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { name, targetAmount, currentAmount, targetDate, linkedAssetId } = parsed.data;

  const resolvedAsset = await resolveLinkedAssetId(linkedAssetId, session.user.id);
  if (!resolvedAsset.ok) return { error: resolvedAsset.error };

  await prisma.financialGoal.create({
    data: {
      userId: session.user.id,
      name,
      targetAmount,
      currentAmount,
      targetDate: targetDate ? new Date(targetDate) : null,
      linkedAssetId: resolvedAsset.linkedAssetId,
    },
  });

  revalidatePath("/finances");
  return {};
}

export async function updateFinancialGoalAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing goal id" };

  const parsed = parseGoalForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { name, targetAmount, currentAmount, targetDate, linkedAssetId } = parsed.data;

  const resolvedAsset = await resolveLinkedAssetId(linkedAssetId, session.user.id);
  if (!resolvedAsset.ok) return { error: resolvedAsset.error };

  const result = await prisma.financialGoal.updateMany({
    where: { id, userId: session.user.id },
    data: {
      name,
      targetAmount,
      currentAmount,
      targetDate: targetDate ? new Date(targetDate) : null,
      linkedAssetId: resolvedAsset.linkedAssetId,
    },
  });

  if (result.count === 0) return { error: "Goal not found" };

  revalidatePath("/finances");
  return {};
}

export async function deleteFinancialGoalAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  await prisma.financialGoal.deleteMany({ where: { id, userId: session.user.id } });

  revalidatePath("/finances");
}
