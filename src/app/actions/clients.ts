"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { clientSchema } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

function parseClientForm(formData: FormData) {
  return clientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    notes: formData.get("notes") || undefined,
    street: formData.get("street") || undefined,
    city: formData.get("city") || undefined,
    state: formData.get("state") || undefined,
    zip: formData.get("zip") || undefined,
    source: formData.get("source") || undefined,
    stage: formData.get("stage") || undefined,
  });
}

export async function createClientAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const parsed = parseClientForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  await prisma.client.create({
    data: {
      userId: session.user.id,
      ...parsed.data,
      emailDeadlineReminders: formData.get("emailDeadlineReminders") === "true",
    },
  });

  revalidatePath("/clients");
  return {};
}

export async function updateClientAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing client id" };

  const parsed = parseClientForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  // A field left blank is cleared, not skipped: Prisma ignores undefined on
  // update, so without the explicit nulls an agent could never remove a
  // client's phone, email or address once entered (2026-11-28).
  const result = await prisma.client.updateMany({
    where: { id, userId: session.user.id },
    data: {
      ...parsed.data,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      notes: parsed.data.notes ?? null,
      street: parsed.data.street ?? null,
      city: parsed.data.city ?? null,
      state: parsed.data.state ?? null,
      zip: parsed.data.zip ?? null,
      source: parsed.data.source ?? null,
      emailDeadlineReminders: formData.get("emailDeadlineReminders") === "true",
    },
  });

  if (result.count === 0) return { error: "Client not found" };

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return {};
}

export async function deleteClientAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  await prisma.client.deleteMany({ where: { id, userId: session.user.id } });

  revalidatePath("/clients");
  redirect("/clients");
}
