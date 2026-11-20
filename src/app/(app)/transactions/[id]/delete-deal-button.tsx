"use client";

import { deleteDealAction } from "@/app/actions/deals";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";

const buttonClass =
  "rounded-full border border-danger px-5 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10";

export function DeleteDealButton({ dealId, propertyAddress }: { dealId: string; propertyAddress: string }) {
  return (
    <ConfirmSubmit
      action={deleteDealAction}
      fields={{ id: dealId }}
      label="Delete deal"
      confirm={`Delete the deal for ${propertyAddress}?`}
      buttonClassName={buttonClass}
    />
  );
}
