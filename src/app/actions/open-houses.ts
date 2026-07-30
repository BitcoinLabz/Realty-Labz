"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { openHouseSchema, openHouseVisitorSchema } from "@/lib/validation";
import { teamOrOwnFilter } from "@/lib/authorization";
import type { FormState } from "@/app/actions/auth";
import type { Role } from "@/generated/prisma/enums";

async function assertDealAccess(
  dealId: string,
  sessionUser: { id: string; role: Role; teamId: string | null },
) {
  return prisma.deal.findFirst({ where: { id: dealId, ...teamOrOwnFilter(sessionUser) } });
}

export async function createOpenHouseAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const dealId = formData.get("dealId");
  if (typeof dealId !== "string" || !dealId) return { error: "Missing deal id" };

  const deal = await assertDealAccess(dealId, session.user);
  if (!deal) return { error: "Deal not found" };

  const parsed = openHouseSchema.safeParse({
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  await prisma.openHouse.create({
    data: {
      dealId,
      date: new Date(parsed.data.date),
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      notes: parsed.data.notes,
    },
  });

  revalidatePath(`/deals/${dealId}`);
  return {};
}

export async function deleteOpenHouseAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  const dealId = formData.get("dealId");
  if (typeof id !== "string" || typeof dealId !== "string") return;

  const deal = await assertDealAccess(dealId, session.user);
  if (!deal) return;

  // Scoped by both id AND dealId, same cross-tenant guard as
  // deal-deadlines.ts -- id alone isn't enough.
  await prisma.openHouse.deleteMany({ where: { id, dealId } });

  revalidatePath(`/deals/${dealId}`);
}

// Public, unauthenticated -- matches the /sign/[id] trust model: openHouseId
// is an unguessable cuid, no login required to sign in at an open house.
export async function submitOpenHouseVisitorAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const openHouseId = formData.get("openHouseId");
  if (typeof openHouseId !== "string" || !openHouseId) return { error: "Missing open house id" };

  const openHouse = await prisma.openHouse.findUnique({ where: { id: openHouseId } });
  if (!openHouse) return { error: "This open house link is no longer valid" };

  const parsed = openHouseVisitorSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    interested: formData.get("interested") || undefined,
    feedback: formData.get("feedback") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  await prisma.openHouseVisitor.create({
    data: {
      openHouseId,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      interested: parsed.data.interested === undefined ? null : parsed.data.interested === "true",
      feedback: parsed.data.feedback,
    },
  });

  return {};
}
