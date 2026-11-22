"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";

export type ScheduleTableColumn = { key: string; label: string };
export type ScheduleTableRow = Record<string, number | string>;

// The numbers behind a chart. On a phone each year is a card, so nothing
// scrolls sideways. The full table stays on a wider screen.
export function ScheduleTable({
  columns,
  rows,
}: {
  columns: ScheduleTableColumn[];
  rows: ScheduleTableRow[];
}) {
  const [expanded, setExpanded] = useState(true);
  const [label, ...rest] = columns;
  if (!label) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex min-h-11 items-center text-sm font-medium text-accent hover:opacity-80"
      >
        {expanded ? "Hide the numbers" : "Show the numbers"}
      </button>

      {expanded ? (
        <>
          <ul className="mt-3 flex max-h-96 flex-col gap-2 overflow-y-auto md:hidden">
            {rows.map((row, i) => (
              <li key={i} className="rounded-xl border border-border px-4 py-3">
                <p className="text-sm font-medium text-foreground">{String(row[label.key])}</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                  {rest.map((column) => {
                    const value = row[column.key];
                    return (
                      <div key={column.key}>
                        <dt className="text-xs text-muted">{column.label}</dt>
                        <dd className="text-sm tabular-nums text-foreground">
                          {typeof value === "number" ? formatCurrency(value) : value}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </li>
            ))}
          </ul>
          <div className="mt-3 hidden max-h-80 overflow-y-auto overflow-x-auto rounded-xl border border-border md:block">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className={`sticky top-0 whitespace-nowrap border-b border-border bg-surface px-4 py-2 font-medium text-muted ${
                        c.key === "label" ? "text-left" : "text-right"
                      }`}
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
                        <td
                          key={c.key}
                          className={`whitespace-nowrap px-4 py-2 tabular-nums text-foreground ${
                            c.key === "label" ? "text-left" : "text-right"
                          }`}
                        >
                          {typeof value === "number" ? formatCurrency(value) : value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
