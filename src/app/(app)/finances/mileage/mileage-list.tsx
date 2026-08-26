"use client";

import { useState } from "react";
import { deleteMileageLogAction } from "@/app/actions/mileage";
import { formatCurrency } from "@/lib/format";
import { formatMileageRate } from "@/lib/mileage-rate";
import { MileageForm } from "./mileage-form";
import type { MileageLogDTO } from "./types";

export function MileageList({ logs }: { logs: MileageLogDTO[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted">
        No trips logged this year. Every business mile you drive is worth money back at tax time — log your first one above.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {logs.map((log) =>
        editingId === log.id ? (
          <div key={log.id} className="rounded-2xl border border-accent bg-background p-6">
            <MileageForm
              defaultValues={{
                id: log.id,
                date: log.date,
                miles: String(log.miles),
                isBusiness: log.isBusiness,
                note: log.note ?? "",
              }}
              onDone={() => setEditingId(null)}
            />
          </div>
        ) : (
          <div
            key={log.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-6 py-4"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {log.note || (log.isBusiness ? "Business trip" : "Personal trip")}
              </span>
              <span className="text-sm text-muted">
                {new Date(log.date + "T00:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {" · "}
                {log.miles} mi
              </span>
              {log.isBusiness ? (
                // The rate that applied to THIS trip, shown per entry for IRS
                // documentation: the standard rate changed mid-2026, so two
                // trips in the same year can legitimately differ.
                <span className="text-xs text-muted">
                  IRS rate {formatMileageRate(log.ratePerMile)}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-4">
              {log.isBusiness ? (
                <span className="text-sm font-semibold text-accent">
                  +{formatCurrency(log.deduction)}
                </span>
              ) : (
                <span className="text-sm text-muted">Not deductible</span>
              )}
              <button
                type="button"
                onClick={() => setEditingId(log.id)}
                className="text-sm font-medium text-muted hover:text-foreground"
              >
                Edit
              </button>
              <form
                action={deleteMileageLogAction}
                onSubmit={(e) => {
                  if (!confirm("Delete this trip?")) e.preventDefault();
                }}
              >
                <input type="hidden" name="id" value={log.id} />
                <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
                  Delete
                </button>
              </form>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
