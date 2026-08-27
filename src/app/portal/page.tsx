import type { Metadata } from "next";
import { CalendarClock, FileText, Home, Mail } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";
import { resolvePortalClientId } from "@/lib/client-portal";
import { dealDisplayName } from "@/app/(app)/transactions/types";

// Reached by an unguessable magic link, so it should never be indexed.
export const metadata: Metadata = {
  title: "Your portal",
  robots: { index: false, follow: false },
};

// Written for the client, not the agent. "Under contract" means something to
// a buyer; "UNDER_CONTRACT" and internal pipeline jargon don't.
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Looking / on the market",
  UNDER_CONTRACT: "Under contract",
  PENDING: "Pending",
  CLOSED: "Closed",
  FELL_THROUGH: "Didn't go through",
};

function formatDate(value: Date | string) {
  const iso = typeof value === "string" ? value : value.toISOString();
  return new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ExpiredNotice() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      <Logo size="md" />
      <h1 className="text-xl font-semibold text-foreground">This link has expired</h1>
      <p className="max-w-sm text-sm text-muted">
        For your security these links don&apos;t last forever. Ask your agent to send you a new one
        and you&apos;ll be right back in.
      </p>
    </div>
  );
}

export default async function ClientPortalPage() {
  const clientId = await resolvePortalClientId();
  if (!clientId) return <ExpiredNotice />;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    // The agent's contact details, so a client looking at a deadline has an
    // obvious way to ask about it instead of hunting for an old email.
    include: { user: { select: { name: true, email: true } } },
  });
  if (!client) return <ExpiredNotice />;

  const [deals, documents] = await Promise.all([
    prisma.deal.findMany({
      where: { clientId },
      select: {
        id: true,
        propertyAddress: true,
        status: true,
        closingDate: true,
        deadlines: { where: { completedAt: null }, orderBy: { dueDate: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.document.findMany({
      where: { clientId },
      select: { id: true, fileName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
        <Logo size="md" />

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Hi {client.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Everything your agent is working on for you, in one place. Nobody else can see this
            page.
          </p>
        </div>

        <Card
          title="Your properties"
          icon={Home}
          description="Where each one stands, and any dates coming up."
        >
          {deals.length === 0 ? (
            <EmptyState
              icon={Home}
              title="Nothing here yet"
              description="Once your agent starts working on a property for you, it'll show up here with its status and key dates."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {deals.map((deal) => (
                <div key={deal.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <span className="text-sm font-medium text-foreground">
                      {dealDisplayName(deal.propertyAddress)}
                    </span>
                    <span className="shrink-0 text-sm font-medium text-muted">
                      {STATUS_LABELS[deal.status] ?? deal.status}
                    </span>
                  </div>
                  {deal.closingDate ? (
                    <p className="mt-1 text-sm text-muted">
                      Closing {formatDate(deal.closingDate)}
                    </p>
                  ) : null}
                  {deal.deadlines.length > 0 ? (
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                        <CalendarClock size={13} />
                        Dates to know
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {deal.deadlines.map((d) => {
                          const isPast = new Date(d.dueDate) < today;
                          return (
                            <div
                              key={d.id}
                              className="flex items-baseline justify-between gap-4 text-sm"
                            >
                              <span className="text-foreground">{d.label}</span>
                              <span
                                className={`shrink-0 ${isPast ? "text-danger" : "text-muted"}`}
                              >
                                {formatDate(d.dueDate)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Your documents"
          icon={FileText}
          description="Tap any file to download a copy."
        >
          {documents.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents yet"
              description="Anything your agent shares with you — contracts, disclosures, inspection reports — will be here to download."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {documents.map((doc) => (
                <a
                  key={doc.id}
                  href={`/api/portal/documents/${doc.id}`}
                  className="flex flex-col gap-0.5 rounded-xl border border-border px-4 py-3 transition-colors hover:border-accent sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <span className="min-w-0 break-words text-sm font-medium text-foreground">
                    {doc.fileName}
                  </span>
                  <span className="shrink-0 text-sm text-muted">{formatDate(doc.createdAt)}</span>
                </a>
              ))}
            </div>
          )}
        </Card>

        <Card title="Your agent" icon={Mail} description="Questions about anything above? Just ask.">
          <p className="text-sm font-medium text-foreground">{client.user.name ?? "Your agent"}</p>
          <a
            href={`mailto:${client.user.email}`}
            className="mt-0.5 inline-block text-sm font-medium text-accent hover:opacity-80"
          >
            {client.user.email}
          </a>
        </Card>
      </div>
    </div>
  );
}
