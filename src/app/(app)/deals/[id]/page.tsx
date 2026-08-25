import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { teamOrOwnFilter, teamSharedFilter } from "@/lib/authorization";
import { formatCurrency } from "@/lib/format";
import { calculateNetCommission, getReferralPartnerTotals } from "@/lib/finance-data";
import { DealForm, type DealFormValues } from "../deal-form";
import { ContractAnalyzer } from "./contract-analyzer";
import { DeadlineList } from "./deadline-list";
import { DealDocuments } from "./deal-documents";
import { DeleteDealButton } from "./delete-deal-button";
import { OpenHouseSection } from "./open-house-section";
import { ReferralPartnerSection } from "./referral-partner-section";
import { FormSubmissionList } from "../../forms/form-submission-list";
import { SendFormWidget, type SendableTemplate } from "../../forms/[id]/send-form-widget";
import { DetailTabs } from "@/components/ui/detail-tabs";
import { isAiConfigured } from "@/lib/ai-contract-analysis";
import { dealDisplayName } from "../types";
import type { DealDeadlineDTO, OpenHouseDTO, ReferralPartnerDTO } from "../types";
import type { DocumentDTO } from "../../forms/types";
import type { FormSubmissionSummaryDTO } from "../../forms/templates/types";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const [deal, clients, referralPartners, formSubmissions, formTemplates] = await Promise.all([
    prisma.deal.findFirst({
      where: { id, ...teamOrOwnFilter(session!.user) },
      include: {
        deadlines: { orderBy: { dueDate: "asc" } },
        documents: { orderBy: { createdAt: "desc" } },
        client: { select: { id: true, name: true, email: true } },
        expenses: { where: { type: "EXPENSE" }, orderBy: { date: "desc" } },
        openHouses: {
          orderBy: { date: "desc" },
          include: { visitors: { orderBy: { createdAt: "desc" } } },
        },
      },
    }),
    prisma.client.findMany({
      where: teamOrOwnFilter(session!.user),
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getReferralPartnerTotals(session!.user.id),
    prisma.formSubmission.findMany({
      where: { dealId: id, ...teamOrOwnFilter(session!.user) },
      include: { formTemplate: true, client: { select: { name: true } }, signers: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.formTemplate.findMany({
      where: teamSharedFilter(session!.user),
      include: { signers: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!deal) notFound();

  const referralPartnerDtos: ReferralPartnerDTO[] = referralPartners;

  const documentDtos: DocumentDTO[] = deal.documents.map((d) => ({
    id: d.id,
    fileName: d.fileName,
    mimeType: d.mimeType,
    size: d.size,
    clientId: d.clientId,
    dealId: d.dealId,
    createdAt: d.createdAt.toISOString(),
  }));

  const formSubmissionDtos: FormSubmissionSummaryDTO[] = formSubmissions.map((s) => ({
    id: s.id,
    templateName: s.formTemplate.name,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    clientId: s.clientId,
    clientName: s.client?.name ?? null,
    signers: s.signers
      .map((signer) => ({ id: signer.id, name: signer.name, status: signer.status, order: signer.order }))
      .sort((a, b) => a.order - b.order),
  }));

  const sendableTemplates: SendableTemplate[] = formTemplates
    .filter((t) => t.signers.length > 0)
    .map((t) => ({
      id: t.id,
      name: t.name,
      signers: t.signers.map((s) => ({ id: s.id, order: s.order, label: s.label })),
    }));

  const defaultValues: DealFormValues = {
    id: deal.id,
    side: deal.side,
    status: deal.status,
    propertyAddress: deal.propertyAddress ?? "",
    mlsNumber: deal.mlsNumber ?? "",
    listPrice: deal.listPrice ? String(deal.listPrice) : "",
    salePrice: deal.salePrice ? String(deal.salePrice) : "",
    commissionRate: deal.commissionRate ? String(deal.commissionRate) : "",
    commissionAmount: deal.commissionAmount ? String(deal.commissionAmount) : "",
    brokerageSplitPercent: deal.brokerageSplitPercent ? String(deal.brokerageSplitPercent) : "",
    referralFeeAmount: deal.referralFeeAmount ? String(deal.referralFeeAmount) : "",
    referralPartnerId: deal.referralPartnerId ?? "",
    teamSplitAmount: deal.teamSplitAmount ? String(deal.teamSplitAmount) : "",
    otherDeductions: deal.otherDeductions ? String(deal.otherDeductions) : "",
    closingDate: deal.closingDate ? deal.closingDate.toISOString().slice(0, 10) : "",
    notes: deal.notes ?? "",
    clientId: deal.clientId ?? "",
  };

  const grossCommission = deal.commissionAmount ? Number(deal.commissionAmount) : 0;
  const netCommission = calculateNetCommission(grossCommission, {
    brokerageSplitPercent: deal.brokerageSplitPercent ? Number(deal.brokerageSplitPercent) : null,
    referralFeeAmount: deal.referralFeeAmount ? Number(deal.referralFeeAmount) : null,
    teamSplitAmount: deal.teamSplitAmount ? Number(deal.teamSplitAmount) : null,
    otherDeductions: deal.otherDeductions ? Number(deal.otherDeductions) : null,
  });
  const dealExpenseTotal = deal.expenses.reduce((sum, t) => sum + Number(t.amount), 0);
  const dealProfit = netCommission - dealExpenseTotal;
  const hasCommissionSplits =
    deal.brokerageSplitPercent || deal.referralFeeAmount || deal.teamSplitAmount || deal.otherDeductions;

  const deadlineDtos: DealDeadlineDTO[] = deal.deadlines.map((d) => ({
    id: d.id,
    label: d.label,
    dueDate: d.dueDate.toISOString().slice(0, 10),
    completedAt: d.completedAt ? d.completedAt.toISOString() : null,
  }));

  const openHouseDtos: OpenHouseDTO[] = deal.openHouses.map((oh) => ({
    id: oh.id,
    date: oh.date.toISOString().slice(0, 10),
    startTime: oh.startTime,
    endTime: oh.endTime,
    notes: oh.notes,
    visitors: oh.visitors.map((v) => ({
      id: v.id,
      name: v.name,
      email: v.email,
      phone: v.phone,
      interested: v.interested,
      feedback: v.feedback,
      createdAt: v.createdAt.toISOString(),
    })),
  }));

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <>
          <section className="rounded-2xl border border-border bg-background p-8">
            <h2 className="mb-6 text-base font-semibold text-foreground">Deal details</h2>
            <div className="max-w-md">
              <DealForm
                key={deal.updatedAt.toISOString()}
                clients={clients}
                referralPartners={referralPartnerDtos}
                defaultValues={defaultValues}
              />
            </div>
          </section>

          {grossCommission > 0 ? (
            <section className="rounded-2xl border border-border bg-background p-8">
              <h2 className="mb-6 text-base font-semibold text-foreground">Deal financials</h2>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Gross commission</span>
                  <span className="font-medium text-foreground">{formatCurrency(grossCommission)}</span>
                </div>
                {hasCommissionSplits ? (
                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <span className="text-muted">Net commission (after splits)</span>
                    <span className="font-medium text-foreground">{formatCurrency(netCommission)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-muted">
                    Deal expenses{deal.expenses.length > 0 ? ` (${deal.expenses.length})` : ""}
                  </span>
                  <span className="font-medium text-foreground">
                    {dealExpenseTotal > 0 ? `-${formatCurrency(dealExpenseTotal)}` : formatCurrency(0)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="font-semibold text-foreground">Deal profit</span>
                  <span className={`font-semibold ${dealProfit >= 0 ? "text-accent" : "text-danger"}`}>
                    {formatCurrency(dealProfit)}
                  </span>
                </div>
              </div>

              {deal.expenses.length > 0 ? (
                <div className="mt-6 flex flex-col gap-2 border-t border-border pt-6">
                  {deal.expenses.map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{t.description || "Expense"}</span>
                      <span className="text-muted">{formatCurrency(Number(t.amount))}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-6 text-sm text-muted">
                  No expenses linked to this deal yet — link one from{" "}
                  <a href="/finances/transactions" className="font-medium text-accent hover:opacity-80">
                    Transactions
                  </a>
                  .
                </p>
              )}
            </section>
          ) : null}
        </>
      ),
    },
    {
      id: "deadlines",
      label: "Deadlines",
      content: (
        <section className="rounded-2xl border border-border bg-background p-8">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-foreground">Contingencies &amp; deadlines</h2>
            {deadlineDtos.length > 0 ? (
              <a
                href={`/api/calendar/deals/${deal.id}`}
                className="text-sm font-medium text-accent hover:opacity-80"
              >
                Add to calendar
              </a>
            ) : null}
          </div>
          <DeadlineList dealId={deal.id} deadlines={deadlineDtos} />
        </section>
      ),
    },
    {
      id: "documents-forms",
      label: "Documents & Forms",
      content: (
        <>
          {isAiConfigured() ? (
            <section className="rounded-2xl border border-border bg-background p-8">
              <h2 className="mb-1 text-base font-semibold text-foreground">
                Read a contract for deadlines
              </h2>
              <p className="mb-6 text-sm text-muted">
                Have an uploaded contract read for its key dates — you review everything before
                anything is saved.
              </p>
              <ContractAnalyzer dealId={deal.id} documents={documentDtos} />
            </section>
          ) : null}

          <section className="rounded-2xl border border-border bg-background p-8">
            <h2 className="mb-6 text-base font-semibold text-foreground">Documents</h2>
            <DealDocuments dealId={deal.id} clientId={deal.clientId} documents={documentDtos} />
          </section>

          <section className="rounded-2xl border border-border bg-background p-8">
            <h2 className="mb-1 text-base font-semibold text-foreground">Forms &amp; envelopes</h2>
            <p className="mb-6 text-sm text-muted">
              Every contract and signature request sent for this property.
            </p>

            {formSubmissionDtos.length > 0 ? (
              <div className="mb-6">
                <FormSubmissionList submissions={formSubmissionDtos} />
              </div>
            ) : null}

            <div className="max-w-md border-t border-border pt-6">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Send a form to sign</h3>
              <SendFormWidget
                client={
                  deal.client ? { id: deal.client.id, name: deal.client.name, email: deal.client.email } : undefined
                }
                templates={sendableTemplates}
                lockedDealId={deal.id}
              />
            </div>
          </section>
        </>
      ),
    },
    {
      id: "open-houses",
      label: "Open houses",
      content: (
        <section className="rounded-2xl border border-border bg-background p-8">
          <h2 className="mb-6 text-base font-semibold text-foreground">Open houses</h2>
          <OpenHouseSection dealId={deal.id} openHouses={openHouseDtos} />
        </section>
      ),
    },
    {
      id: "referral-partners",
      label: "Referral partners",
      content: (
        <section className="rounded-2xl border border-border bg-background p-8">
          <h2 className="mb-1 text-base font-semibold text-foreground">Referral partners</h2>
          <ReferralPartnerSection dealId={deal.id} partners={referralPartnerDtos} />
        </section>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={deal.client ? `/forms/${deal.client.id}` : "/forms"}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
        >
          ← Back to {deal.client ? deal.client.name : "Clients"}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {dealDisplayName(deal.propertyAddress, deal.client?.name)}
        </h1>
        <p className="mt-1 text-sm text-muted">Manage this deal&apos;s details and deadlines.</p>
      </div>

      <DetailTabs tabs={tabs} />

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-3 text-base font-semibold text-foreground">Danger zone</h2>
        <p className="mb-4 text-sm text-muted">
          Deleting a deal also removes its deadlines. Linked documents and clients are kept.
        </p>
        <DeleteDealButton
          dealId={deal.id}
          propertyAddress={dealDisplayName(deal.propertyAddress, deal.client?.name)}
        />
      </section>
    </div>
  );
}
