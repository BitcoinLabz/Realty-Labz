"use client";

import { deleteDealAction } from "@/app/actions/deals";

export function DeleteDealButton({
  dealId,
  propertyAddress,
}: {
  dealId: string;
  propertyAddress: string;
}) {
  return (
    <form
      action={deleteDealAction}
      onSubmit={(e) => {
        if (!confirm(`Delete the deal for ${propertyAddress}?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={dealId} />
      <button
        type="submit"
        className="rounded-full border border-danger px-5 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
      >
        Delete deal
      </button>
    </form>
  );
}
