import Link from "next/link";
import type { FormSubmissionSummaryDTO } from "./types";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Sent",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  DECLINED: "Declined",
};

const STATUS_CLASSES: Record<string, string> = {
  PENDING: "text-muted",
  IN_PROGRESS: "text-accent",
  COMPLETED: "text-[var(--chart-2)]",
  DECLINED: "text-danger",
};

export function SubmissionList({ submissions }: { submissions: FormSubmissionSummaryDTO[] }) {
  if (submissions.length === 0) {
    return <p className="text-sm text-muted">Nothing sent for signature yet. Pick a ready-to-send form and email it to a client from their page.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {submissions.map((s) => {
        const row = (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{s.templateName}</span>
              <span className="text-sm text-muted">
                {s.clientName ?? "No client linked"} · Sent{" "}
                {new Date(s.createdAt).toLocaleDateString()}
              </span>
            </div>
            <span className={`text-sm font-medium ${STATUS_CLASSES[s.status] ?? "text-muted"}`}>
              {STATUS_LABELS[s.status] ?? s.status}
            </span>
          </div>
        );
        return s.clientId ? (
          <Link key={s.id} href={`/clients/${s.clientId}`} className="hover:opacity-80">
            {row}
          </Link>
        ) : (
          <div key={s.id}>{row}</div>
        );
      })}
    </div>
  );
}
