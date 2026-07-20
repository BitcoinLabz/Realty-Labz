"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";

export type ScheduleTableColumn = { key: string; label: string };
export type ScheduleTableRow = Record<string, number | string>;

// Shows the exact numbers behind every point plotted on a chart, so the
// numbers can be checked by hand (or against an outside mortgage calculator)
// instead of just trusting the line -- 2026-07-20, direct founder request.
export function ScheduleTable({
  columns,
  rows,
}: {
  columns: ScheduleTableColumn[];
  rows: ScheduleTableRow[];
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-sm font-medium text-accent hover:opacity-80"
      >
        {expanded ? "Hide the numbers" : "Show the numbers"}
      </button>

      {expanded ? (
        <div className="mt-3 max-h-80 overflow-y-auto overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className="whitespace-nowrap border-b border-border px-4 py-2 text-left font-medium text-muted"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {columns.map((c) => {
                    const value = row[c.key];
                    return (
                      <td key={c.key} className="whitespace-nowrap px-4 py-2 text-foreground">
                        {typeof value === "number" ? formatCurrency(value) : value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
