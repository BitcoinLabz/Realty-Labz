"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { mileageLogSchema } from "@/lib/validation";
import { calculateMileageDeduction } from "@/lib/mileage-rate";
import { getMileageRate } from "@/lib/mileage-rate-db";
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
  const deduction = calculateMileageDeduction(miles, ratePerMile, isBusiness);

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

  revalidatePath("/finances/mileage");
  revalidatePath("/finances");
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
  const deduction = calculateMileageDeduction(miles, ratePerMile, isBusiness);

  const result = await prisma.mileageLog.updateMany({
    where: { id, userId: session.user.id },
    data: { date: tripDate, miles, isBusiness, note, ratePerMile, deduction },
  });

  if (result.count === 0) return { error: "Mileage log not found" };

  revalidatePath("/finances/mileage");
  revalidatePath("/finances");
  revalidatePath("/dashboard");
  return {};
}

export async function deleteMileageLogAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  await prisma.mileageLog.deleteMany({ where: { id, userId: session.user.id } });

  revalidatePath("/finances/mileage");
  revalidatePath("/finances");
  revalidatePath("/dashboard");
}
