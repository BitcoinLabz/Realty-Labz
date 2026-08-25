"use client";

import { deleteClientAction } from "@/app/actions/clients";

export function DeleteClientButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  return (
    <form
      action={deleteClientAction}
      onSubmit={(e) => {
        if (!confirm(`Delete ${clientName}?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={clientId} />
      <button
        type="submit"
        className="rounded-full border border-danger px-5 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
      >
        Delete client
      </button>
    </form>
  );
}
