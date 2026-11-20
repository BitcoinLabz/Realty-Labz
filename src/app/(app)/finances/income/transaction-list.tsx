"use client";

import { useState } from "react";
import { deleteTransactionAction } from "@/app/actions/transactions";
import { formatCurrency } from "@/lib/format";
import { RowMenu } from "@/components/ui/row-menu";
import { TransactionForm } from "./transaction-form";
import type { DealOption, TransactionDTO } from "./types";

const categoryLabels: Record<string, string> = {
  MILEAGE: "Mileage",
  HOME_OFFICE: "Home office",
  PHONE: "Phone",
  MARKETING_ADVERTISING: "Marketing & advertising",
  MLS_DUES: "MLS / association dues",
  CONTINUING_EDUCATION: "Continuing education",
  CLIENT_GIFTS: "Client gifts",
  OFFICE_SUPPLIES: "Office supplies",
  SOFTWARE_SUBSCRIPTIONS: "Software & subscriptions",
  INSURANCE: "Insurance",
  LICENSING_FEES: "Licensing fees",
  MEALS_ENTERTAINMENT: "Meals & entertainment",
  PROFESSIONAL_SERVICES: "Professional services",
  OTHER: "Other",
};

export function TransactionList({
  transactions,
  deals = [],
}: {
  transactions: TransactionDTO[];
  deals?: DealOption[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted">
        Nothing logged for this year yet. Add your first income or expense above.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {transactions.map((t) =>
        editingId === t.id ? (
          <div key={t.id} className="rounded-2xl border border-accent bg-background p-6">
            <TransactionForm
              defaultValues={{
                id: t.id,
                type: t.type,
                scope: t.scope,
                category: t.category ?? "OTHER",
                amount: String(t.amount),
                description: t.description ?? "",
                date: t.date,
                dealId: t.dealId ?? "",
              }}
              deals={deals}
              onDone={() => setEditingId(null)}
            />
          </div>
        ) : (
          // Text wraps instead of squeezing; the amount and the one "..." menu
          // never get pushed off a phone screen (2026-11-19).
          <div
            key={t.id}
            className="flex items-center gap-3 rounded-2xl border border-border bg-background py-3 pl-4 pr-1 sm:pl-6"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="line-clamp-2 break-words text-sm font-medium text-foreground">
                {t.description || (t.category ? categoryLabels[t.category] : "Personal")}
              </span>
              <span className="truncate text-sm text-muted">
                {new Date(t.date + "T00:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {" · "}
                {t.scope === "PERSONAL" ? "Personal" : "Business"}
                {t.category ? ` · ${categoryLabels[t.category]}` : ""}
              </span>
            </div>
            <span
              className={`shrink-0 text-sm font-semibold tabular-nums ${t.type === "INCOME" ? "text-accent" : "text-foreground"}`}
            >
              {t.type === "INCOME" ? "+" : "-"}
              {formatCurrency(t.amount)}
            </span>
            <RowMenu
              label={`Actions for ${t.description || "this entry"}`}
              items={[
                { label: "Edit", onSelect: () => setEditingId(t.id) },
                {
                  label: "Delete",
                  destructive: true,
                  confirm: "Delete this entry?",
                  action: deleteTransactionAction,
                  fields: { id: t.id },
                },
              ]}
            />
          </div>
        ),
      )}
    </div>
  );
}
