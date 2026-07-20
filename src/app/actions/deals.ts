"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { dealSchema } from "@/lib/validation";
import { teamOrOwnFilter } from "@/lib/authorization";
import type { FormState } from "@/app/actions/auth";

function parseDealForm(formData: FormData) {
  return dealSchema.safeParse({
    side: formData.get("side"),
    status: formData.get("status"),
    propertyAddress: formData.get("propertyAddress"),
    mlsNumber: formData.get("mlsNumber") || undefined,
    listPrice: formData.get("listPrice") || undefined,
    salePrice: formData.get("salePrice") || undefined,
    commissionRate: formData.get("commissionRate") || undefined,
    commissionAmount: formData.get("commissionAmount") || undefined,
    closingDate: formData.get("closingDate") || undefined,
    notes: formData.get("notes") || undefined,
    clientId: formData.get("clientId") || undefined,
  });
}

export async function createDealAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const parsed = parseDealForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { clientId, closingDate, ...rest } = parsed.data;

  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, ...teamOrOwnFilter(session.user) },
    });
    if (!client) return { error: "Client not found" };
  }

  await prisma.deal.create({
    data: {
      ...rest,
      closingDate: closingDate ? new Date(closingDate) : null,
      clientId: clientId || null,
      userId: session.user.id,
    },
  });

  if (clientId) revalidatePath(`/clients/${clientId}`);
  return {};
}

export async function updateDealAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing deal id" };

  const parsed = parseDealForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { clientId, closingDate, ...rest } = parsed.data;

  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, ...teamOrOwnFilter(session.user) },
    });
    if (!client) return { error: "Client not found" };
  }

  const result = await prisma.deal.updateMany({
    where: { id, ...teamOrOwnFilter(session.user) },
    data: {
      ...rest,
      closingDate: closingDate ? new Date(closingDate) : null,
      clientId: clientId || null,
    },
  });

  if (result.count === 0) return { error: "Deal not found" };

  revalidatePath(`/deals/${id}`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
  return {};
}

export async function deleteDealAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const deal = await prisma.deal.findFirst({
    where: { id, ...teamOrOwnFilter(session.user) },
    select: { clientId: true },
  });

  await prisma.deal.deleteMany({ where: { id, ...teamOrOwnFilter(session.user) } });

  if (deal?.clientId) {
    revalidatePath(`/clients/${deal.clientId}`);
    redirect(`/clients/${deal.clientId}`);
  } else {
    redirect("/clients");
  }
}
