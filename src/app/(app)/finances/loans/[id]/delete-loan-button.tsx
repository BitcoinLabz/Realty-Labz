"use client";

import { deleteLoanAction } from "@/app/actions/loans";

export function DeleteLoanButton({ loanId, loanName }: { loanId: string; loanName: string }) {
  return (
    <form
      action={deleteLoanAction}
      onSubmit={(e) => {
        if (!confirm(`Delete "${loanName}"? This also deletes its logged extra payments.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={loanId} />
      <button
        type="submit"
        className="rounded-full border border-danger px-5 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
      >
        Delete loan
      </button>
    </form>
  );
}
