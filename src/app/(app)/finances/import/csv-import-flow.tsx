"use client";

import { useActionState, useEffect, useState } from "react";
import {
  confirmCsvImportAction,
  previewCsvImportAction,
  type CsvPreviewRow,
  type CsvPreviewState,
} from "@/app/actions/csv-import";
import type { FormState } from "@/app/actions/auth";
import { SELECTABLE_TRANSACTION_CATEGORIES } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { FileDropInput } from "@/components/ui/file-drop-input";
import { formatCurrency } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/transaction-categories";

const initialPreviewState: CsvPreviewState = {};
const initialConfirmState: FormState = {};

type EditableRow = CsvPreviewRow & { skip: boolean };
type SelectableCategory = (typeof SELECTABLE_TRANSACTION_CATEGORIES)[number];

const selectClass =
  "rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20";

export function CsvImportFlow() {
  const [previewState, previewAction, isPreviewing] = useActionState(previewCsvImportAction, initialPreviewState);
  const [confirmState, confirmAction, isConfirming] = useActionState(confirmCsvImportAction, initialConfirmState);
  const [rows, setRows] = useState<EditableRow[] | null>(null);

  useEffect(() => {
    if (previewState.rows) {
      // Syncing local editable-row state from a fresh useActionState result
      // (the preview step's parsed rows) -- an external system by this rule's
      // own definition, not derivable during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRows(previewState.rows.map((r) => ({ ...r, skip: r.isDuplicate })));
    }
  }, [previewState.rows]);

  const confirmed = !confirmState.error && confirmState !== initialConfirmState;

  if (confirmed) {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 text-center">
        <p className="text-sm font-medium text-foreground">Import complete.</p>
        <p className="mt-1 text-sm text-muted">
          Head over to{" "}
          <a href="/finances/income" className="font-medium text-accent hover:opacity-80">
            Transactions
          </a>{" "}
          to see them.
        </p>
        <button
          type="button"
          onClick={() => setRows(null)}
          className="mt-4 text-sm font-medium text-accent hover:opacity-80"
        >
          Import another file
        </button>
      </div>
    );
  }

  if (!rows) {
    return (
      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-1 text-base font-semibold text-foreground">Import from a bank statement</h2>
        <p className="mb-6 text-sm text-muted">
          Export a CSV from your bank and upload it here — the date, description, and amount (or
          debit/credit) columns are detected automatically. Nothing is saved until you review and
          confirm below.
        </p>
        <form action={previewAction} className="flex max-w-md flex-col gap-4">
          <FileDropInput id="csv-file" accept=".csv" required helperText="CSV files only." error={previewState.error} />
          <div>
            <Button type="submit" disabled={isPreviewing}>
              {isPreviewing ? "Reading…" : "Preview import"}
            </Button>
          </div>
        </form>
      </section>
    );
  }

  function updateRow(index: number, patch: Partial<EditableRow>) {
    setRows((prev) => prev!.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  const includedCount = rows.filter((r) => !r.skip).length;
  const rowsToSubmit = rows
    .filter((r) => !r.skip)
    .map((r) => ({
      date: r.date,
      description: r.description || undefined,
      amount: r.amount,
      type: r.type,
      scope: r.scope,
      category: r.scope === "BUSINESS" && r.type === "EXPENSE" ? (r.category ?? "OTHER") : undefined,
    }));

  return (
    <section className="rounded-2xl border border-border bg-background p-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">
          Review {rows.length} row{rows.length === 1 ? "" : "s"}
        </h2>
        <button
          type="button"
          onClick={() => setRows(null)}
          className="text-sm font-medium text-muted hover:text-foreground"
        >
          Start over
        </button>
      </div>

      <div className="flex flex-col gap-2 overflow-x-auto">
        {rows.map((row, i) => (
          <div
            key={i}
            className={`flex min-w-max items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm ${
              row.skip ? "opacity-50" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={!row.skip}
              onChange={(e) => updateRow(i, { skip: !e.target.checked })}
              aria-label={`Include ${row.description || "this row"}`}
            />
            <span className="w-24 shrink-0 text-muted">{row.date}</span>
            <span className="w-48 shrink-0 truncate text-foreground">{row.description || "—"}</span>
            <span
              className={`w-24 shrink-0 text-right font-medium ${
                row.type === "INCOME" ? "text-accent" : "text-foreground"
              }`}
            >
              {row.type === "INCOME" ? "+" : "-"}
              {formatCurrency(row.amount)}
            </span>
            <select
              value={row.scope}
              onChange={(e) => updateRow(i, { scope: e.target.value as "BUSINESS" | "PERSONAL" })}
              className={selectClass}
            >
              <option value="BUSINESS">Business</option>
              <option value="PERSONAL">Personal</option>
            </select>
            {row.scope === "BUSINESS" && row.type === "EXPENSE" ? (
              <select
                value={row.category ?? "OTHER"}
                onChange={(e) => updateRow(i, { category: e.target.value as SelectableCategory })}
                className={selectClass}
              >
                {SELECTABLE_TRANSACTION_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {CATEGORY_LABELS[value] ?? value}
                  </option>
                ))}
              </select>
            ) : null}
            {row.isDuplicate ? <span className="shrink-0 text-xs text-danger">Possible duplicate</span> : null}
          </div>
        ))}
      </div>

      <form action={confirmAction} className="mt-6">
        <input type="hidden" name="rows" value={JSON.stringify(rowsToSubmit)} />
        {confirmState.error ? <p className="mb-3 text-sm text-danger">{confirmState.error}</p> : null}
        <Button type="submit" disabled={isConfirming || includedCount === 0}>
          {isConfirming ? "Importing…" : `Import ${includedCount} transaction${includedCount === 1 ? "" : "s"}`}
        </Button>
      </form>
    </section>
  );
}
