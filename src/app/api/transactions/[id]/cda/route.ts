import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { dealReadFilter } from "@/lib/authorization";
import { calculateCommissionAmount } from "@/lib/commission";
import { computeCdaLines } from "@/lib/cda";
import { CdaDocument, type CdaData } from "@/lib/pdf/cda";
import { dealDisplayName, DEAL_SIDE_LABELS } from "@/app/(app)/transactions/types";

// The commission disbursement form for one transaction (2026-10-02). Read
// scope only: the agent, or their office on a file it can see
// (dealReadFilter -- never a file the agent hid).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const deal = await prisma.deal.findFirst({
    where: { id, ...dealReadFilter(session.user) },
    include: {
      user: { select: { name: true, email: true, team: { select: { name: true } } } },
      client: { select: { name: true } },
      referralPartner: { select: { name: true } },
      vendors: { where: { vendor: { kind: "TITLE" } }, include: { vendor: { select: { name: true } } }, take: 1 },
    },
  });
  if (!deal) return new NextResponse("Not found", { status: 404 });

  const gross =
    (deal.commissionAmount ? Number(deal.commissionAmount) : null) ??
    calculateCommissionAmount(
      deal.salePrice ? Number(deal.salePrice) : null,
      deal.commissionRate ? Number(deal.commissionRate) : null,
    );
  if (!gross) {
    return new NextResponse("Add the sale price and commission to this transaction first.", { status: 400 });
  }

  const lines = computeCdaLines(gross, {
    brokerageSplitPercent: deal.brokerageSplitPercent ? Number(deal.brokerageSplitPercent) : null,
    referralFeePercent: deal.referralFeePercent ? Number(deal.referralFeePercent) : null,
    teamSplitPercent: deal.teamSplitPercent ? Number(deal.teamSplitPercent) : null,
    otherDeductionsPercent: deal.otherDeductionsPercent ? Number(deal.otherDeductionsPercent) : null,
  });

  const data: CdaData = {
    brokerageName: deal.user.team?.name ?? "Brokerage",
    agentName: deal.user.name ?? deal.user.email,
    propertyAddress: dealDisplayName(deal.propertyAddress, deal.client?.name),
    clientName: deal.client?.name ?? null,
    side: DEAL_SIDE_LABELS[deal.side],
    salePrice: deal.salePrice ? Number(deal.salePrice) : null,
    closingDate: deal.closingDate
      ? deal.closingDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
      : null,
    titleCompany: deal.vendors[0]?.vendor.name ?? null,
    referralPartner: deal.referralPartner?.name ?? null,
    lines,
    generatedOn: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
  };

  // Same cast as the financial report: renderToBuffer's types want the
  // element's props to literally be DocumentProps.
  const element = createElement(CdaDocument, { data }) as Parameters<typeof renderToBuffer>[0];
  const buffer = await renderToBuffer(element);
  const slug = (deal.propertyAddress ?? "transaction").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="commission-disbursement-${slug}.pdf"`,
    },
  });
}
