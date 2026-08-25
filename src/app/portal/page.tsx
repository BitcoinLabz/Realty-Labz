import { Logo } from "@/components/ui/logo";
import { prisma } from "@/lib/db";
import { resolvePortalClientId } from "@/lib/client-portal";
import { dealDisplayName } from "@/app/(app)/deals/types";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  UNDER_CONTRACT: "Under Contract",
  PENDING: "Pending",
  CLOSED: "Closed",
  FELL_THROUGH: "Fell Through",
};

function ExpiredNotice() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <Logo size="md" />
      <h1 className="text-xl font-semibold text-foreground">This link has expired</h1>
      <p className="max-w-sm text-sm text-muted">
        Ask your agent to send you a fresh link to view your deal and document status.
      </p>
    </div>
  );
}

export default async function ClientPortalPage() {
  const clientId = await resolvePortalClientId();
  if (!clientId) return <ExpiredNotice />;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
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
      select: { id: true, fileName: true, size: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-10">
      <div className="flex items-center gap-3">
        <Logo size="md" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome, {client.name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Here&apos;s the current status of your deals and documents.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Your properties &amp; offers</h2>
        {deals.length === 0 ? (
          <p className="text-sm text-muted">Nothing to show yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {deals.map((deal) => (
              <div key={deal.id} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-foreground">
                    {dealDisplayName(deal.propertyAddress)}
                  </span>
                  <span className="text-sm font-medium text-muted">{STATUS_LABELS[deal.status]}</span>
                </div>
                {deal.closingDate ? (
                  <p className="mt-1 text-sm text-muted">
                    Closing{" "}
                    {new Date(deal.closingDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                ) : null}
                {deal.deadlines.length > 0 ? (
                  <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
                    {deal.deadlines.map((d) => (
                      <div key={d.id} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{d.label}</span>
                        <span className="text-muted">
                          {new Date(d.dueDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Your documents</h2>
        {documents.length === 0 ? (
          <p className="text-sm text-muted">No documents shared with you yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {documents.map((doc) => (
              <a
                key={doc.id}
                href={`/api/portal/documents/${doc.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3 hover:border-accent"
              >
                <span className="text-sm font-medium text-foreground">{doc.fileName}</span>
                <span className="text-sm text-muted">
                  {new Date(doc.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
