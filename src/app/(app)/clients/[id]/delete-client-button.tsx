"use client";

import { deleteClientAction } from "@/app/actions/clients";
import { ConfirmSubmit } from "@/components/ui/confirm-submit";

const buttonClass =
  "rounded-full border border-danger px-5 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10";

export function DeleteClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  return (
    <ConfirmSubmit
      action={deleteClientAction}
      fields={{ id: clientId }}
      label="Delete client"
      confirm={`Delete ${clientName}?`}
      buttonClassName={buttonClass}
    />
  );
}
