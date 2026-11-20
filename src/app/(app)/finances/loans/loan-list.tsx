import Link from "next/link";
import { Landmark } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/format";
import type { LoanDTO } from "./types";

const typeLabels: Record<string, string> = {
  MORTGAGE: "Mortgage",
  AUTO: "Auto",
  OTHER: "Other",
};

export function LoanList({ loans }: { loans: LoanDTO[] }) {
  if (loans.length === 0) {
    return (
      <EmptyState
        icon={Landmark}
        title="No loans yet"
        description="Add a mortgage, a car loan, or anything else you're paying off. The monthly payment, balance, and payoff date are worked out for you."
        actionLabel="Add a loan"
        actionHref="#add-loan"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {loans.map((l) => (
        <Link
          key={l.id}
          href={`/finances/loans/${l.id}`}
          className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-6 py-4 transition-colors hover:border-accent"
        >
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{l.name}</span>
            <span className="text-sm text-muted">
              {typeLabels[l.type]} · {l.interestRate}% · {l.termMonths} mo
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold text-foreground">
              {l.isPaidOff ? "Paid off" : `${formatCurrency(l.totalMonthlyPayment)}/mo`}
            </span>
            <span className="text-sm text-muted">{formatCurrency(l.remainingBalance)} remaining</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
