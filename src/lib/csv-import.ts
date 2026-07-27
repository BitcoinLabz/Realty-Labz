import Papa from "papaparse";

// Bank CSV exports vary a lot (quoted fields with embedded commas, a single
// signed "Amount" column vs. separate Debit/Credit columns, "(45.00)"
// accounting-style negatives) — papaparse handles the quoting correctly,
// this module handles the rest via a small set of header-name heuristics
// rather than demanding one fixed format.
const DATE_HEADER = /date/i;
const DESCRIPTION_HEADER = /desc|memo|payee|merchant|name/i;
const AMOUNT_HEADER = /^amount$|^amt$/i;
const DEBIT_HEADER = /debit/i;
const CREDIT_HEADER = /credit/i;

export type ParsedCsvRow = {
  date: string; // ISO yyyy-mm-dd
  description: string;
  // Signed: positive reads as income-like (a credit/deposit), negative as
  // expense-like (a debit/withdrawal) -- see toTransactionInput below.
  amount: number;
};

export type CsvParseResult =
  | { ok: true; rows: ParsedCsvRow[] }
  | { ok: false; error: string };

function findHeader(headers: string[], pattern: RegExp): string | undefined {
  return headers.find((h) => pattern.test(h));
}

function parseAmount(value: string | undefined): number {
  if (!value || !value.trim()) return 0;
  const trimmed = value.trim();
  const isParenNegative = trimmed.startsWith("(") && trimmed.endsWith(")");
  const cleaned = trimmed.replace(/[()$,]/g, "");
  const num = Number(cleaned);
  if (Number.isNaN(num)) return NaN;
  return isParenNegative ? -Math.abs(num) : num;
}

export function parseCsv(fileContents: string): CsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(fileContents, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.data.length === 0) {
    return { ok: false, error: "Couldn't find any rows in this file." };
  }

  const headers = parsed.meta.fields ?? [];
  const dateHeader = findHeader(headers, DATE_HEADER);
  const descriptionHeader = findHeader(headers, DESCRIPTION_HEADER);
  const amountHeader = findHeader(headers, AMOUNT_HEADER);
  const debitHeader = findHeader(headers, DEBIT_HEADER);
  const creditHeader = findHeader(headers, CREDIT_HEADER);

  if (!dateHeader) return { ok: false, error: "Couldn't find a date column in this file." };
  if (!amountHeader && !debitHeader && !creditHeader) {
    return { ok: false, error: "Couldn't find an amount, debit, or credit column in this file." };
  }

  const rows: ParsedCsvRow[] = [];
  for (const raw of parsed.data) {
    const dateValue = raw[dateHeader];
    if (!dateValue) continue;
    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) continue;

    let amount: number;
    if (amountHeader) {
      amount = parseAmount(raw[amountHeader]);
    } else {
      const debit = debitHeader ? parseAmount(raw[debitHeader]) : 0;
      const credit = creditHeader ? parseAmount(raw[creditHeader]) : 0;
      amount = credit - Math.abs(debit);
    }
    if (Number.isNaN(amount) || amount === 0) continue;

    rows.push({
      date: parsedDate.toISOString().slice(0, 10),
      description: descriptionHeader ? (raw[descriptionHeader] ?? "").trim() : "",
      amount,
    });
  }

  return { ok: true, rows };
}

export function toTransactionInput(row: ParsedCsvRow): {
  type: "INCOME" | "EXPENSE";
  amount: number;
  date: string;
  description: string | undefined;
} {
  return {
    type: row.amount >= 0 ? "INCOME" : "EXPENSE",
    amount: Math.abs(row.amount),
    date: row.date,
    description: row.description || undefined,
  };
}

// Duplicate guard: an identical date+amount+description already existing for
// this user very likely means this row was already imported (or entered by
// hand) -- skip it so re-uploading the same statement doesn't double-count.
export function isDuplicateRow(
  row: ParsedCsvRow,
  existing: { date: Date; amount: number; description: string | null }[],
): boolean {
  return existing.some(
    (t) =>
      t.date.toISOString().slice(0, 10) === row.date &&
      Math.abs(Number(t.amount) - Math.abs(row.amount)) < 0.005 &&
      (t.description ?? "") === row.description,
  );
}
