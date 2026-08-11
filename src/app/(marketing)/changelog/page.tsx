import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Changelog — Realty Labz",
  description: "What's new in Realty Labz.",
};

// A hand-curated, plain-language translation of what's actually shipped —
// not the internal dev log. Add a new entry here when a real user-facing
// feature ships; keep descriptions in product language, not implementation
// detail.
const entries: { date: string; title: string; description: string }[] = [
  {
    date: "August 2026",
    title: "Security & performance hardening pass",
    description:
      "Patched a PDF-rendering security advisory, added database indexes across the app for faster page loads as your data grows, and closed several smaller gaps found in a full code audit.",
  },
  {
    date: "July 2026",
    title: "CRM extras: lead pipeline, open houses, referral tracking",
    description:
      "Track where a lead came from and their pipeline stage, run open-house sign-ins with showing feedback, add-to-calendar for deals and deadlines, and track running totals owed to referral partners.",
  },
  {
    date: "July 2026",
    title: "Client portal",
    description:
      "Share a private link so a client can check their own deal status and documents anytime, without creating an account.",
  },
  {
    date: "July 2026",
    title: "Full personal & business finances",
    description:
      "Net worth tracking, budgets and goals, loan amortization with extra-payment payoff projections, live crypto/stock value tracking, estimated quarterly taxes, and CSV bank import.",
  },
  {
    date: "July 2026",
    title: "Legally-binding e-signature contracts",
    description:
      "A reusable form template library with a drag-and-drop field designer, sequential multi-signer routing, and a full consent/IP/timestamp audit trail on every signed document.",
  },
  {
    date: "July 2026",
    title: "Teams & broker dashboard",
    description:
      "Invite your team, see every agent's deals and commissions in one place, and catch missing paperwork before it becomes a problem.",
  },
  {
    date: "June 2026",
    title: "Realty Labz launches",
    description:
      "Deal and client tracking, mileage and expense logging, document storage, and an accountant-ready PDF export — the foundation everything else is built on.",
  },
];

export default function ChangelogPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Changelog</h1>
        <p className="text-sm text-muted">What&apos;s new in Realty Labz.</p>
      </div>

      <div className="flex flex-col gap-8">
        {entries.map((entry) => (
          <div key={entry.title} className="flex flex-col gap-1.5 border-l-2 border-border pl-5">
            <span className="text-xs font-medium tracking-wide text-muted uppercase">{entry.date}</span>
            <h2 className="text-base font-semibold text-foreground">{entry.title}</h2>
            <p className="text-sm leading-relaxed text-muted">{entry.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
