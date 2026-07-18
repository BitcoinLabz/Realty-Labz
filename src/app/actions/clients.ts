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
    data: { userId: session.user.id, ...parsed.data },
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

  const result = await prisma.client.updateMany({
    where: { id, userId: session.user.id },
    data: parsed.data,
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
