import Link from "next/link";
import { ChevronRight, Download, FileText, FolderOpen, House, Landmark, Receipt } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { YearSelect } from "@/components/ui/year-select";
import { formatCurrency } from "@/lib/format";
import { getHomeOfficeData } from "@/lib/home-office-data";

// Reports (2026-11-19): everything an agent hands their accountant, in one
// place, for the year they pick. The documents themselves are built
// elsewhere; this page only gathers them.
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const session = await auth();
  const userId = session!.user.id;
  const currentYear = new Date().getFullYear();
  const { year: yearParam } = await searchParams;
  const year = Number(yearParam) || currentYear;
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const [entryCount, tripCount, closedDeals, homeOffice, taxDocCount] = await Promise.all([
    prisma.transaction.count({ where: { userId, scope: "BUSINESS", date: { gte: start, lt: end } } }),
    prisma.mileageLog.count({ where: { userId, isBusiness: true, date: { gte: start, lt: end } } }),
    prisma.deal.findMany({
      where: { userId, status: "CLOSED", closingDate: { gte: start, lt: end } },
      select: { id: true, propertyAddress: true },
      orderBy: { closingDate: "desc" },
      take: 5,
    }),
    getHomeOfficeData(userId, year),
    prisma.document.count({ where: { userId, clientId: null, dealId: null, homeOfficeExpense: { is: null } } }),
  ]);

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];
  const homeOfficeAllowed = homeOffice.current?.allowed ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Reports"
        description="Everything your accountant needs for the year, ready to download."
        action={<YearSelect year={year} options={yearOptions} basePath="/reports" />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ReportCard
          icon={FileText}
          title="Financial summary"
          description={`Net income, every business income and expense entry, mileage, and commissions for ${year}. ${entryCount} entr${
            entryCount === 1 ? "y" : "ies"
          } and ${tripCount} business trip${tripCount === 1 ? "" : "s"}.`}
          download={`/api/reports/pdf?year=${year}`}
          downloadLabel="Download PDF"
        />
        <ReportCard
          icon={House}
          title="Home office report"
          description={
            homeOffice.current
              ? `${formatCurrency(homeOfficeAllowed)} deduction (${homeOffice.current.method === "REGULAR" ? "regular method, Form 8829" : "simplified method"}), with depreciation, carryovers and receipts.`
              : "Set up your home office to get a full Form 8829 breakdown for your accountant."
          }
          download={homeOffice.current ? `/api/reports/home-office?year=${year}` : undefined}
          downloadLabel="Download PDF"
          link={homeOffice.current ? undefined : { href: "/home-office", label: "Set up home office" }}
        />
        <ReportCard
          icon={Landmark}
          title="Estimated taxes"
          description="Self-employment, federal, Michigan and city tax on this year's profit, split into quarterly payments."
          link={{ href: `/finances/taxes?year=${year}`, label: "View estimate" }}
        />
        <ReportCard
          icon={Receipt}
          title="Commission statements"
          description={
            closedDeals.length > 0
              ? `Each closed transaction has a commission disbursement form (CDA). ${closedDeals.length}${closedDeals.length === 5 ? "+" : ""} closed in ${year}.`
              : `A commission disbursement form (CDA) is on every closed transaction. None closed in ${year} yet.`
          }
          link={{ href: "/transactions", label: "Open transactions" }}
        />
        <ReportCard
          icon={FolderOpen}
          title="Tax documents"
          description={`Receipts and statements not filed with a client or transaction. ${taxDocCount} on file.`}
          link={{ href: `/finances/taxes?year=${year}`, label: "Open tax documents" }}
        />
      </div>

      <p className="text-sm text-muted">
        Reports are for record-keeping and review by your accountant, not tax advice. Michigan rules apply.
      </p>
    </div>
  );
}

function ReportCard({
  icon: Icon,
  title,
  description,
  download,
  downloadLabel,
  link,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
  download?: string;
  downloadLabel?: string;
  link?: { href: string; label: string };
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pl-12">
        {download ? (
          <a
            href={download}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
          >
            <Download size={15} />
            {downloadLabel}
          </a>
        ) : null}
        {link ? (
          <Link
            href={link.href}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface"
          >
            {link.label}
            <ChevronRight size={15} />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
