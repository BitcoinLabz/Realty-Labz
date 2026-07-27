"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { csvImportRowSchema, SELECTABLE_TRANSACTION_CATEGORIES } from "@/lib/validation";
import { isDuplicateRow, parseCsv, toTransactionInput } from "@/lib/csv-import";
import type { FormState } from "@/app/actions/auth";

export type CsvPreviewRow = {
  date: string;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  scope: "BUSINESS" | "PERSONAL";
  category: (typeof SELECTABLE_TRANSACTION_CATEGORIES)[number] | null;
  isDuplicate: boolean;
};

export type CsvPreviewState = FormState & { rows?: CsvPreviewRow[] };

// Step 1: parse the uploaded file and flag likely-already-imported rows --
// nothing is written to the database yet. Defaults every row to BUSINESS
// expense/income by amount sign; the confirm step lets the agent bulk-adjust
// scope/category before anything is actually saved.
export async function previewCsvImportAction(
  _prevState: CsvPreviewState,
  formData: FormData,
): Promise<CsvPreviewState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file to upload" };
  }

  const text = await file.text();
  const parsed = parseCsv(text);
  if (!parsed.ok) return { error: parsed.error };
  if (parsed.rows.length === 0) return { error: "No usable rows found in this file" };

  const dates = parsed.rows.map((r) => new Date(r.date));
  const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
  const latest = new Date(Math.max(...dates.map((d) => d.getTime())));

  const existing = await prisma.transaction.findMany({
    where: { userId: session.user.id, date: { gte: earliest, lte: latest } },
    select: { date: true, amount: true, description: true },
  });
  const existingForDedup = existing.map((t) => ({
    date: t.date,
    amount: Number(t.amount),
    description: t.description,
  }));

  const rows: CsvPreviewRow[] = parsed.rows.map((row) => {
    const input = toTransactionInput(row);
    return {
      date: input.date,
      description: input.description ?? "",
      amount: input.amount,
      type: input.type,
      scope: "BUSINESS",
      category: input.type === "EXPENSE" ? "OTHER" : null,
      isDuplicate: isDuplicateRow(row, existingForDedup),
    };
  });

  return { rows };
}

// Step 2: the (possibly bulk-edited) rows come back as a JSON blob, same
// pattern saveFormFieldsAction already uses for the field-designer's array
// of fields -- validated server-side, not trusted as-is from the client.
export async function confirmCsvImportAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const rowsJson = formData.get("rows");
  if (typeof rowsJson !== "string") return { error: "Missing rows" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(rowsJson);
  } catch {
    return { error: "Malformed row data" };
  }
  if (!Array.isArray(parsed)) return { error: "Malformed row data" };

  const rows = [];
  for (const row of parsed) {
    const result = csvImportRowSchema.safeParse(row);
    if (!result.success) return { error: "One or more rows failed validation" };
    rows.push(result.data);
  }

  if (rows.length === 0) return { error: "No rows selected to import" };

  await prisma.transaction.createMany({
    data: rows.map((row) => ({
      userId: session.user.id,
      type: row.type,
      scope: row.scope,
      category: row.scope === "BUSINESS" && row.type === "EXPENSE" ? (row.category ?? "OTHER") : null,
      amount: row.amount,
      description: row.description,
      date: new Date(row.date),
    })),
  });

  revalidatePath("/finances");
  revalidatePath("/dashboard");
  return {};
}
