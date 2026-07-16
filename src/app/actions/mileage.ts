"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { mileageLogSchema } from "@/lib/validation";
import { getMileageRate } from "@/lib/mileage-rate";
import type { FormState } from "@/app/actions/auth";

function parseMileageForm(formData: FormData) {
  return mileageLogSchema.safeParse({
    date: formData.get("date"),
    miles: formData.get("miles"),
    isBusiness: formData.get("isBusiness"),
    note: formData.get("note") || undefined,
  });
}

export async function createMileageLogAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const parsed = parseMileageForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { date, miles, isBusiness, note } = parsed.data;
  const tripDate = new Date(date);
  const ratePerMile = await getMileageRate(tripDate);
  const deduction = isBusiness ? miles * ratePerMile : 0;

  await prisma.mileageLog.create({
    data: {
      userId: session.user.id,
      date: tripDate,
      miles,
      isBusiness,
      note,
      ratePerMile,
      deduction,
    },
  });

  revalidatePath("/mileage");
  revalidatePath("/dashboard");
  return {};
}

export async function updateMileageLogAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing mileage log id" };

  const parsed = parseMileageForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { date, miles, isBusiness, note } = parsed.data;
  const tripDate = new Date(date);
  const ratePerMile = await getMileageRate(tripDate);
  const deduction = isBusiness ? miles * ratePerMile : 0;

  const result = await prisma.mileageLog.updateMany({
    where: { id, userId: session.user.id },
    data: { date: tripDate, miles, isBusiness, note, ratePerMile, deduction },
  });

  if (result.count === 0) return { error: "Mileage log not found" };

  revalidatePath("/mileage");
  revalidatePath("/dashboard");
  return {};
}

export async function deleteMileageLogAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  await prisma.mileageLog.deleteMany({ where: { id, userId: session.user.id } });

  revalidatePath("/mileage");
  revalidatePath("/dashboard");
}
