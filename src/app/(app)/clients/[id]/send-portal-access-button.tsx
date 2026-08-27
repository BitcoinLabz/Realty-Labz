"use client";

import { useActionState, useState } from "react";
import { sendPortalAccessAction, type PortalAccessState } from "@/app/actions/client-portal";
import { Button } from "@/components/ui/button";

const initialState: PortalAccessState = {};

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="text-sm font-medium text-accent hover:opacity-80"
    >
      {copied ? "Copied!" : "Copy the link"}
    </button>
  );
}

export function SendPortalAccessButton({
  clientId,
  hasEmail,
}: {
  clientId: string;
  hasEmail: boolean;
}) {
  const [state, formAction, isPending] = useActionState(sendPortalAccessAction, initialState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      <Button type="submit" variant="secondary" disabled={isPending || !hasEmail}>
        {isPending ? "Sending…" : "Send portal access"}
      </Button>
      {!hasEmail ? (
        <p className="text-sm text-muted">Add an email address for this client first.</p>
      ) : null}
      {state.success ? <p className="text-sm text-accent">{state.success}</p> : null}
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.portalUrl ? <CopyLinkButton url={state.portalUrl} /> : null}
    </form>
  );
}
