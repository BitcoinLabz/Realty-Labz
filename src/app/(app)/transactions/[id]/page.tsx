import Link from "next/link";
import { BadgeDollarSign, Copy, FileDown } from "lucide-react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canWorkOfficeChecklist, dealReadFilter, teamOrOwnFilter, teamSharedFilter } from "@/lib/authorization";
import { OfficeChecklist, type OfficeTaskDTO } from "./office-checklist";
import { PaperworkList, type PaperworkItemDTO } from "./paperwork-list";
import { DealVendors, type DealVendorDTO } from "./deal-vendors";
import { OfficeUploadForm } from "./office-upload-form";
import { paperworkStatus } from "@/lib/paperwork";
import { taxSetAside } from "@/lib/estimated-tax";
import { Badge } from "@/components/ui/badge";
import { ShareWithBrokerage } from "./share-with-brokerage";
import type { DeadlineTemplateDTO } from "../deadline-sets/types";
import { formatCurrency } from "@/lib/format";
import { calculateNetCommission } from "@/lib/finance-data";
import { DealForm, type DealFormValues } from "../transaction-form";
import { ContractAssistant } from "./contract-assistant";
import { E_SIGNATURE_ENABLED } from "@/lib/features";
import { DeadlineList } from "./deadline-list";
import { DealDocuments } from "./deal-documents";
import { DeleteDealButton } from "./delete-deal-button";
import { ReadOnlyDealView } from "./read-only-view";
import { OpenHouseSection } from "./open-house-section";
import { FormSubmissionList } from "@/app/(app)/clients/form-submission-list";
import { SendFormWidget, type SendableTemplate } from "@/app/(app)/clients/[id]/send-form-widget";
import { DetailTabs } from "@/components/ui/detail-tabs";
import { isAiConfigured } from "@/lib/ai-contract-analysis";
import { duplicateDealAction } from "@/app/actions/deals";
import { logCommissionAsIncomeAction } from "@/app/actions/transactions";
import { DEAL_SIDE_LABELS, DEAL_STATUS_LABELS, DEAL_STATUS_TONES, dealDisplayName } from "../types";
import type { DealDeadlineDTO, OpenHouseDTO } from "../types";
import type { DocumentDTO } from "@/app/(app)/clients/types";
import type { FormSubmissionSummaryDTO } from "../../forms/templates/types";

export default async function DealDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  // ?read={documentId} arrives from New transaction → "I have a signed
  // contract": the Contract assistant starts reading it on arrival.
  searchParams: Promise<{ read?: string }>;
}) {
  const { id } = await params;
  const { read } = await searchParams;
  const session = await auth();

  const [
    deal,
    clients,
    referralPartners,
    formSubmissions,
    formTemplates,
    deadlineTemplateRows,
    loggedCommission,
    ownClients,
  ] =
    await Promise.all([
    prisma.deal.findFirst({
      where: { id, ...dealReadFilter(session!.user) },
      include: {
        deadlines: { orderBy: { dueDate: "asc" } },
        documents: { orderBy: { createdAt: "desc" } },
        client: { select: { id: true, name: true, email: true } },
        user: { select: { name: true, teamId: true } },
        officeTasks: { orderBy: { order: "asc" } },
        vendors: { include: { vendor: true }, orderBy: { createdAt: "asc" } },
        expenses: { where: { type: "EXPENSE" }, orderBy: { date: "desc" } },
        openHouses: {
          orderBy: { date: "desc" },
          include: { visitors: { orderBy: { createdAt: "desc" } } },
        },
      },
    }),
    // userId, not teamOrOwnFilter: a manager sees the team's TRANSACTIONS,
    // never its clients. This picker was the one place that leaked teammate
    // client names, and it contradicted /transactions/new, which already
    // scoped the same dropdown correctly.
    prisma.client.findMany({
      where: { userId: session!.user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // Just names for the "Referral owed to" picker -- the list itself lives
    // under Finances -> Referrals (2026-10-03).
    prisma.referralPartner.findMany({
      where: { userId: session!.user.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
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
    prisma.deadlineTemplate.findMany({
      where: teamSharedFilter(session!.user),
      include: { items: { orderBy: { order: "asc" } } },
      orderBy: { name: "asc" },
    }),
    // The deal include above filters expenses to type EXPENSE, so it cannot
    // see a linked commission-income row -- this is that check.
    prisma.transaction.findFirst({
      where: { userId: session!.user.id, dealId: id, type: "INCOME" },
      select: { id: true },
    }),
    // Just enough to tell whether an open-house sign-in is already in this
    // agent's Clients list. Scoped to their OWN clients, not the team's --
    // the convert button creates the record under the acting user, so
    // matching against a teammate's roster would hide a button that would
    // in fact have created a legitimately new client.
    prisma.client.findMany({
      where: { userId: session!.user.id },
      select: { id: true, name: true, email: true },
    }),
  ]);

  if (!deal) notFound();

  // A manager reached this through dealReadFilter -- they can see the team's
  // transactions because a broker is accountable for files closed under their
  // license. Supervision means reading a file, not editing it, so anyone who
  // doesn't own this one gets the read-and-download view instead.
  //
  // This is presentation. The boundary itself lives in the server actions,
  // every one of which is scoped by ownerOnlyFilter.
  const officeTaskDtos: OfficeTaskDTO[] = deal.officeTasks.map((t) => ({
    id: t.id,
    label: t.label,
    dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
    note: t.note,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
  }));

  // The agent's office's paperwork list for this kind of transaction. Empty
  // for a solo agent, so nothing changes for them.
  const requirements = deal.user.teamId
    ? await prisma.requiredDocument.findMany({
        where: { teamId: deal.user.teamId, sides: { has: deal.side } },
        orderBy: { order: "asc" },
      })
    : [];
  const paperwork = paperworkStatus(requirements, deal.documents, deal.side);
  const paperworkItems: PaperworkItemDTO[] = paperwork.items.map((i) => ({
    requirementId: i.requirement.id,
    label: i.requirement.label,
    document: i.document ? { id: i.document.id, fileName: i.document.fileName } : null,
  }));
  const requirementOptions = requirements.map((r) => ({ id: r.id, label: r.label }));

  // The office's vendor directory, and the vendors already on this file.
  const toVendorDto = (v: {
    id: string;
    kind: string;
    name: string;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
  }): DealVendorDTO => ({
    id: v.id,
    kind: v.kind,
    name: v.name,
    contactName: v.contactName,
    email: v.email,
    phone: v.phone,
    notes: v.notes,
  });
  const vendorDirectory = deal.user.teamId
    ? (await prisma.vendor.findMany({ where: { teamId: deal.user.teamId }, orderBy: { name: "asc" } })).map(toVendorDto)
    : [];
  const attachedVendors = deal.vendors.map((dv) => toVendorDto(dv.vendor));
  const isOfficeViewer = canWorkOfficeChecklist(session!.user) && deal.user.teamId === session!.user.teamId;

  if (deal.userId !== session!.user.id) {
    return (
      <ReadOnlyDealView
        cdaHref={deal.commissionAmount && Number(deal.commissionAmount) > 0 ? `/api/transactions/${deal.id}/cda` : null}
        vendors={
          <DealVendors
            dealId={deal.id}
            attached={attachedVendors}
            directory={vendorDirectory}
            canEdit={isOfficeViewer}
          />
        }
        dealId={deal.id}
        requirementOptions={canWorkOfficeChecklist(session!.user) ? requirementOptions : []}
        documentRequirements={Object.fromEntries(deal.documents.map((d) => [d.id, d.requirementId]))}
        paperwork={<PaperworkList dealId={deal.id} clientId={null} items={paperworkItems} mode="office" />}
        officeUpload={canWorkOfficeChecklist(session!.user) ? <OfficeUploadForm dealId={deal.id} /> : null}
        officeChecklist={
          <OfficeChecklist
            dealId={deal.id}
            tasks={officeTaskDtos}
            canEdit={canWorkOfficeChecklist(session!.user)}
          />
        }
        agentName={deal.user.name}
        propertyAddress={deal.propertyAddress}
        clientName={deal.client?.name ?? null}
        side={deal.side}
        status={deal.status}
        mlsNumber={deal.mlsNumber}
        listPrice={deal.listPrice ? Number(deal.listPrice) : null}
        salePrice={deal.salePrice ? Number(deal.salePrice) : null}
        closingDate={deal.closingDate ? deal.closingDate.toISOString() : null}
        grossCommission={deal.commissionAmount ? Number(deal.commissionAmount) : 0}
        deadlines={deal.deadlines.map((d) => ({
          id: d.id,
          label: d.label,
          dueDate: d.dueDate.toISOString(),
          completedAt: d.completedAt ? d.completedAt.toISOString() : null,
        }))}
        documents={deal.documents.map((d) => ({
          id: d.id,
          fileName: d.fileName,
          createdAt: d.createdAt.toISOString(),
        }))}
      />
    );
  }

  const referralPartnerDtos = referralPartners;

  const documentDtos: DocumentDTO[] = deal.documents.map((d) => ({
    id: d.id,
    fileName: d.fileName,
    mimeType: d.mimeType,
    size: d.size,
    clientId: d.clientId,
    dealId: d.dealId,
    createdAt: d.createdAt.toISOString(),
    requirementId: d.requirementId,
    addedByOffice: d.userId !== deal.userId,
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
    referralFeePercent: deal.referralFeePercent ? String(deal.referralFeePercent) : "",
    referralPartnerId: deal.referralPartnerId ?? "",
    teamSplitPercent: deal.teamSplitPercent ? String(deal.teamSplitPercent) : "",
    otherDeductionsPercent: deal.otherDeductionsPercent ? String(deal.otherDeductionsPercent) : "",
    closingDate: deal.closingDate ? deal.closingDate.toISOString().slice(0, 10) : "",
    notes: deal.notes ?? "",
    clientId: deal.clientId ?? "",
  };

  const grossCommission = deal.commissionAmount ? Number(deal.commissionAmount) : 0;
  const taxSettings = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { estimatedIncomeTaxRatePercent: true },
  });
  const incomeTaxRate = taxSettings?.estimatedIncomeTaxRatePercent
    ? Number(taxSettings.estimatedIncomeTaxRatePercent)
    : null;
  const netCommission = calculateNetCommission(grossCommission, {
    brokerageSplitPercent: deal.brokerageSplitPercent ? Number(deal.brokerageSplitPercent) : null,
    referralFeePercent: deal.referralFeePercent ? Number(deal.referralFeePercent) : null,
    teamSplitPercent: deal.teamSplitPercent ? Number(deal.teamSplitPercent) : null,
    otherDeductionsPercent: deal.otherDeductionsPercent ? Number(deal.otherDeductionsPercent) : null,
  });
  const dealExpenseTotal = deal.expenses.reduce((sum, t) => sum + Number(t.amount), 0);
  const dealProfit = netCommission - dealExpenseTotal;
  const hasCommissionSplits =
    deal.brokerageSplitPercent || deal.referralFeePercent || deal.teamSplitPercent || deal.otherDeductionsPercent;

  const deadlineDtos: DealDeadlineDTO[] = deal.deadlines.map((d) => ({
    id: d.id,
    label: d.label,
    dueDate: d.dueDate.toISOString().slice(0, 10),
    completedAt: d.completedAt ? d.completedAt.toISOString() : null,
    reminderSentAt: d.emailReminderSentAt ? d.emailReminderSentAt.toISOString() : null,
    sourceQuote: d.sourceQuote,
    clientNote: d.clientNote,
  }));

  const deadlineTemplateDtos: DeadlineTemplateDTO[] = deadlineTemplateRows.map((t) => ({
    id: t.id,
    name: t.name,
    creatorName: "",
    items: t.items.map((i) => ({ label: i.label, offsetDays: i.offsetDays })),
  }));

  // Matched on email first (the reliable key), falling back to name for the
  // walk-ins who don't leave one. Deliberately a heuristic, same shape as
  // the CSV importer's duplicate detection -- the cost of a false match is
  // one hidden button, not lost data.
  const clientsByEmail = new Map(
    ownClients.filter((c) => c.email).map((c) => [c.email!.trim().toLowerCase(), c.id]),
  );
  const clientsByName = new Map(ownClients.map((c) => [c.name.trim().toLowerCase(), c.id]));

  function findExistingClientId(visitor: { name: string; email: string | null }) {
    if (visitor.email) {
      return clientsByEmail.get(visitor.email.trim().toLowerCase()) ?? null;
    }
    return clientsByName.get(visitor.name.trim().toLowerCase()) ?? null;
  }

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
      existingClientId: findExistingClientId(v),
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
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                <h2 className="text-base font-semibold text-foreground">Deal financials</h2>
                {/* The form the office sends title so commission is paid out
                    right at closing. Free: rendered here, no outside service. */}
                <a href={`/api/transactions/${deal.id}/cda`} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium text-accent hover:opacity-80">
                  <FileDown size={15} />
                  Commission form (PDF)
                </a>
              </div>
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

              {deal.status === "CLOSED" && netCommission > 0 ? (
                <div className="mt-6 border-t border-border pt-6">
                  {loggedCommission ? (
                    <div className="flex flex-col gap-2 text-sm">
                      <p className="text-muted">
                        {formatCurrency(netCommission)} was added to your income when this closed.{" "}
                        <Link href="/finances/income" className="font-medium text-accent hover:opacity-80">
                          View in Income &amp; expenses
                        </Link>
                      </p>
                      {/* The nudge most agents need at closing: don't spend it all. */}
                      <p className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-surface px-4 py-3">
                        <span className="text-foreground">Set aside for taxes (estimate)</span>
                        <span className="font-semibold text-warning">
                          {formatCurrency(taxSetAside(netCommission, incomeTaxRate))}
                        </span>
                      </p>
                      <p className="text-xs text-muted">
                        Self-employment tax
                        {incomeTaxRate !== null ? ` plus your ${incomeTaxRate}% income-tax rate` : ""}.{" "}
                        {incomeTaxRate === null ? (
                          <Link href="/finances/taxes" className="font-medium text-accent hover:opacity-80">
                            Add your income-tax rate for a fuller estimate
                          </Link>
                        ) : (
                          "Not tax advice."
                        )}
                      </p>
                    </div>
                  ) : (
                    <form action={logCommissionAsIncomeAction}>
                      <input type="hidden" name="dealId" value={deal.id} />
                      <p className="mb-3 text-sm text-muted">
                        Adds {formatCurrency(netCommission)} to your income ledger so it counts
                        toward your tax reporting.
                      </p>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
                      >
                        <BadgeDollarSign size={15} />
                        Log this commission as income
                      </button>
                    </form>
                  )}
                </div>
              ) : null}

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
                  <a href="/finances/income" className="font-medium text-accent hover:opacity-80">
                    Transactions
                  </a>
                  .
                </p>
              )}
            </section>
          ) : null}
          {/* Only meaningful for an agent on a team -- a solo agent has no
              brokerage to share with. */}
          {session!.user.teamId ? (
            <ShareWithBrokerage dealId={deal.id} shared={deal.sharedWithBrokerage} />
          ) : null}
          <DealVendors dealId={deal.id} attached={attachedVendors} directory={vendorDirectory} canEdit />
        </>
      ),
    },
    {
      id: "deadlines",
      label: "Deadlines",
      content: (
        <>
          <section className="rounded-2xl border border-border bg-background p-8">
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <h2 className="text-base font-semibold text-foreground">Contingencies &amp; deadlines</h2>
              {deadlineDtos.length > 0 ? (
                <a
                  href={`/api/calendar/transactions/${deal.id}`}
                  className="shrink-0 whitespace-nowrap text-sm font-medium text-accent hover:opacity-80"
                >
                  Add to calendar
                </a>
              ) : null}
            </div>
            <DeadlineList
              dealId={deal.id}
              deadlines={deadlineDtos}
              deadlineTemplates={deadlineTemplateDtos}
              emailContext={{
                // Everyone on the file with an email: vendors, then the client.
                recipients: [
                  ...attachedVendors
                    .filter((v) => v.email)
                    .map((v) => ({ name: v.name, contactName: v.contactName, email: v.email! })),
                  ...(deal.client?.email
                    ? [{ name: deal.client.name, contactName: deal.client.name, email: deal.client.email }]
                    : []),
                ],
                propertyLabel: dealDisplayName(deal.propertyAddress, deal.client?.name),
                agentName: session!.user.name ?? "",
              }}
            />
          </section>
          {/* The office's list for this file, read-only here, once they've
              started one -- so the agent knows where title, closing and signs
              stand without asking. */}
          {officeTaskDtos.length > 0 ? (
            <OfficeChecklist dealId={deal.id} tasks={officeTaskDtos} canEdit={false} />
          ) : null}
        </>
      ),
    },
    {
      // "documents" is also the #documents link target in ContractAssistant.
      id: "documents",
      label: E_SIGNATURE_ENABLED ? "Documents & Forms" : "Documents",
      content: (
        <>
          <PaperworkList dealId={deal.id} clientId={deal.clientId} items={paperworkItems} mode="agent" />

          <section className="rounded-2xl border border-border bg-background p-8">
            <h2 className="mb-6 text-base font-semibold text-foreground">Documents</h2>
            <DealDocuments
              dealId={deal.id}
              clientId={deal.clientId}
              documents={documentDtos}
              requirementOptions={requirementOptions}
            />
          </section>

          {/* E-signature is switched off (src/lib/features.ts): no new envelopes,
              but ones already sent stay visible here. */}
          {E_SIGNATURE_ENABLED || formSubmissionDtos.length > 0 ? (
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

              {E_SIGNATURE_ENABLED ? (
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
              ) : null}
            </section>
          ) : null}
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
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={deal.client ? `/clients/${deal.client.id}` : "/clients"}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
        >
          ← Back to {deal.client ? deal.client.name : "Clients"}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {dealDisplayName(deal.propertyAddress, deal.client?.name)}
        </h1>
        {/* The file at a glance: where it stands, when it closes, and who
            can see it -- before any tab is opened. */}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          <Badge tone={DEAL_STATUS_TONES[deal.status]}>{DEAL_STATUS_LABELS[deal.status]}</Badge>
          <span>{DEAL_SIDE_LABELS[deal.side]}</span>
          {deal.closingDate ? (
            <span>
              · Closing{" "}
              {deal.closingDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              })}
            </span>
          ) : null}
          {session!.user.teamId && !deal.sharedWithBrokerage ? <span>· Private to you</span> : null}
        </div>
      </div>

      {/* One instance above the tabs, so it never unmounts mid-flow: saving
          adds deadlines, and a card that lived only on a "no deadlines yet"
          tab would vanish along with its confirmation. */}
      <ContractAssistant
        dealId={deal.id}
        enabled={isAiConfigured()}
        hasDeadlines={deadlineDtos.length > 0}
        dealIsActive={deal.status === "ACTIVE"}
        documents={documentDtos}
        existingDeadlines={deadlineDtos.map((d) => ({
          id: d.id,
          label: d.label,
          dueDate: d.dueDate,
          completed: !!d.completedAt,
        }))}
        autoReadDocumentId={
          documentDtos.find((d) => d.id === read && d.mimeType === "application/pdf")?.id ?? null
        }
      />

      <DetailTabs tabs={tabs} />

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-1 text-base font-semibold text-foreground">Start a similar transaction</h2>
        <p className="mb-4 text-sm text-muted">
          Creates a new transaction with the same client and commission setup, ready for a new
          property. Deadlines and documents aren&apos;t copied — their dates belong to this
          contract.
        </p>
        <form action={duplicateDealAction}>
          <input type="hidden" name="id" value={deal.id} />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-border/40"
          >
            <Copy size={15} />
            Duplicate this transaction
          </button>
        </form>
      </section>

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
