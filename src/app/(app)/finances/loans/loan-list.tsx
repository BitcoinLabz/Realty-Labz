"use client";

import { useState } from "react";
import { deleteLoanAction } from "@/app/actions/loans";
import { formatCurrency } from "@/lib/format";
import { LoanForm } from "./loan-form";
import type { LoanDTO } from "./types";

const typeLabels: Record<string, string> = {
  MORTGAGE: "Mortgage",
  AUTO: "Auto",
  OTHER: "Other",
};

export function LoanList({ loans }: { loans: LoanDTO[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (loans.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted">
        No loans yet. Add your first one above.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {loans.map((l) =>
        editingId === l.id ? (
          <div key={l.id} className="rounded-2xl border border-accent bg-background p-6">
            <LoanForm
              key={l.updatedAt}
              defaultValues={{
                id: l.id,
                name: l.name,
                type: l.type,
                purchasePrice: String(l.purchasePrice),
                downPayment: String(l.downPayment),
                interestRate: String(l.interestRate),
                termMonths: String(l.termMonths),
                startDate: l.startDate,
                annualPropertyTax: String(l.annualPropertyTax),
                annualInsurance: String(l.annualInsurance),
                notes: l.notes ?? "",
              }}
              onDone={() => setEditingId(null)}
            />
          </div>
        ) : (
          <div key={l.id} className="rounded-2xl border border-border bg-background px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{l.name}</span>
                <span className="text-sm text-muted">
                  {typeLabels[l.type]} · {l.interestRate}% · {l.termMonths} mo
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-semibold text-foreground">
                    {l.isPaidOff ? "Paid off" : `${formatCurrency(l.totalMonthlyPayment)}/mo`}
                  </span>
                  <span className="text-sm text-muted">
                    {formatCurrency(l.remainingBalance)} remaining
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingId(l.id)}
                  className="text-sm font-medium text-muted hover:text-foreground"
                >
                  Edit
                </button>
                <form
                  action={deleteLoanAction}
                  onSubmit={(e) => {
                    if (!confirm(`Delete "${l.name}"?`)) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="id" value={l.id} />
                  <button type="submit" className="text-sm font-medium text-danger hover:opacity-80">
                    Delete
                  </button>
                </form>
              </div>
            </div>

            {!l.isPaidOff ? (
              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
                <div className="flex flex-col">
                  <span className="text-muted">Principal &amp; interest</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(l.monthlyPrincipalAndInterest)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted">Taxes</span>
                  <span className="font-medium text-foreground">{formatCurrency(l.monthlyTax)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted">Insurance</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(l.monthlyInsurance)}
                  </span>
                </div>
              </div>
            ) : null}

            {l.notes ? <p className="mt-3 text-sm text-muted">{l.notes}</p> : null}
          </div>
        ),
      )}
    </div>
  );
}
