"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { dealDeadlineSchema } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

// Clients aren't team-shared (see CLAUDE.md) -- plain userId check, same
// rule every other client-scoped action in this codebase already follows.
async function assertClientAccess(clientId: string, userId: string) {
  return prisma.client.findFirst({ where: { id: clientId, userId } });
}

export async function createClientDeadlineAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const clientId = formData.get("clientId");
  if (typeof clientId !== "string" || !clientId) return { error: "Missing client id" };

  const client = await assertClientAccess(clientId, session.user.id);
  if (!client) return { error: "Client not found" };

  const parsed = dealDeadlineSchema.safeParse({
    label: formData.get("label"),
    dueDate: formData.get("dueDate"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  await prisma.clientDeadline.create({
    data: {
      clientId,
      label: parsed.data.label,
      dueDate: new Date(parsed.data.dueDate),
    },
  });

  revalidatePath(`/forms/${clientId}`);
  return {};
}

export async function toggleClientDeadlineAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  const clientId = formData.get("clientId");
  const isCompleted = formData.get("isCompleted") === "true";
  if (typeof id !== "string" || typeof clientId !== "string") return;

  const client = await assertClientAccess(clientId, session.user.id);
  if (!client) return;

  // Scoped by both id AND clientId -- id alone would let a user who owns ANY
  // client (to pass assertClientAccess above) mutate a deadline belonging to
  // a completely different tenant's client, since ClientDeadline.id carries
  // no ownership information of its own. Same guard deal-deadlines.ts uses.
  await prisma.clientDeadline.updateMany({
    where: { id, clientId },
    data: { completedAt: isCompleted ? null : new Date() },
  });

  revalidatePath(`/forms/${clientId}`);
}

export async function deleteClientDeadlineAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  const clientId = formData.get("clientId");
  if (typeof id !== "string" || typeof clientId !== "string") return;

  const client = await assertClientAccess(clientId, session.user.id);
  if (!client) return;

  // Same cross-tenant guard as toggleClientDeadlineAction above.
  await prisma.clientDeadline.deleteMany({ where: { id, clientId } });

  revalidatePath(`/forms/${clientId}`);
}
