"use client";

import { deleteLoanAction } from "@/app/actions/loans";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";

const buttonClass =
  "rounded-full border border-danger px-5 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10";

export function DeleteLoanButton({ loanId, loanName }: { loanId: string; loanName: string }) {
  return (
    <ConfirmSubmit
      action={deleteLoanAction}
      fields={{ id: loanId }}
      label="Delete loan"
      confirm={`Delete "${loanName}"? This also deletes its logged extra payments.`}
      buttonClassName={buttonClass}
    />
  );
}
