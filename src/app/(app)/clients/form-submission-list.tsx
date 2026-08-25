"use client";

import { useState } from "react";
import type { FormSubmissionSummaryDTO } from "@/app/(app)/forms/templates/types";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Waiting to be viewed",
  VIEWED: "Viewed",
  COMPLETED: "Signed",
  DECLINED: "Declined",
};

const OVERALL_LABELS: Record<string, string> = {
  PENDING: "Sent",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  DECLINED: "Declined",
};

function CopyLinkButton({ signerId }: { signerId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(`${window.location.origin}/sign/${signerId}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-xs font-medium text-accent hover:opacity-80"
    >
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}

// Generic envelope/submission list — reused on both a client's page and a
// deal's page (a submission can be linked to either, or neither), so this
// intentionally takes no clientId/dealId of its own.
export function FormSubmissionList({ submissions }: { submissions: FormSubmissionSummaryDTO[] }) {
  if (submissions.length === 0) {
    return <p className="text-sm text-muted">Nothing sent for signature yet. When you email a contract out, you can track who has signed it here.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {submissions.map((s) => (
        <div key={s.id} className="rounded-xl border border-border px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-foreground">{s.templateName}</span>
            <span className="text-sm text-muted">{OVERALL_LABELS[s.status] ?? s.status}</span>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {s.signers.map((signer) => (
              <div key={signer.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted">
                  {signer.name} — {STATUS_LABELS[signer.status] ?? signer.status}
                </span>
                {signer.status !== "COMPLETED" && signer.status !== "DECLINED" ? (
                  <CopyLinkButton signerId={signer.id} />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
