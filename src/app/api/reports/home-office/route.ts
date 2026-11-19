import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { APP_URL } from "@/lib/app-url";
import { isRateLimited } from "@/lib/rate-limit";
import { businessUsePercent, countableAmount, depreciationBasis, recaptureEstimate } from "@/lib/home-office";
import { getHomeOfficeData, saveHomeOfficeSnapshots } from "@/lib/home-office-data";
import { HOME_OFFICE_EXPENSE_LABELS } from "@/lib/home-office-labels";
import { homeOfficeStatus } from "@/lib/home-office-status";
import { loadTaxRules } from "@/lib/tax-rules-db";
import { HomeOfficeReport, type HomeOfficeReportData } from "@/lib/pdf/home-office-report";

// The Home Office PDF (2026-11-19), separate from the accountant summary at
// /api/reports/pdf (which links here). Owner-only: everything is read by the
// signed-in user's id.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  const userId = session.user.id;

  if (await isRateLimited(`pdf:${userId}`, { max: 20, windowMinutes: 60 })) {
    return new NextResponse("Too many requests — please wait a few minutes and try again.", { status: 429 });
  }

  const year = Number(request.nextUrl.searchParams.get("year")) || new Date().getFullYear();
  const [data, user, expenses, rules] = await Promise.all([
    getHomeOfficeData(userId, year),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    prisma.homeOfficeExpense.findMany({
      where: { userId, date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
      include: { receipt: { select: { id: true, fileName: true } } },
      orderBy: [{ kind: "asc" }, { date: "asc" }],
    }),
    loadTaxRules(),
  ]);

  const { row, profile, current, chain } = data;
  if (!row || !profile || !current) {
    return new NextResponse("Set up your home office for this year first.", { status: 404 });
  }
  await saveHomeOfficeSnapshots(userId, chain);

  const reportData: HomeOfficeReportData = {
    agentName: user?.name ?? user?.email ?? "Agent",
    year,
    generatedAt: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    officeSqFt: profile.officeSqFt,
    homeSqFt: profile.homeSqFt,
    businessPercent: businessUsePercent(profile),
    businessUseStart: profile.businessUseStart
      ? profile.businessUseStart.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
      : null,
    ownership: profile.ownership,
    current,
    chain,
    basis: depreciationBasis(profile),
    recapture: recaptureEstimate(current.accumulatedDepreciation, year, rules),
    status: homeOfficeStatus(current),
    expenses: expenses.map((e) => ({
      label: HOME_OFFICE_EXPENSE_LABELS[e.kind] + (e.description ? ` — ${e.description}` : ""),
      when:
        e.period === "YEAR"
          ? `Full year ${e.date.getUTCFullYear()}`
          : e.date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
      scope: e.scope,
      amount: Number(e.amount),
      receiptName: e.receipt?.fileName ?? null,
      receiptUrl: e.receipt ? `${APP_URL}/api/documents/${e.receipt.id}` : null,
      counted:
        countableAmount(
          { kind: e.kind, scope: e.scope, period: e.period, date: e.date, amount: Number(e.amount) },
          year,
          profile.businessUseStart,
        ) > 0,
    })),
    eligibility: { regularUse: row.regularUse, exclusiveUse: row.exclusiveUse, principalPlace: row.principalPlace },
  };

  // renderToBuffer's types want a bare <Document> element; the wrapper
  // component renders one (same cast as /api/reports/pdf).
  const element = createElement(HomeOfficeReport, { data: reportData }) as unknown as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="realty-labz-home-office-${year}.pdf"`,
    },
  });
}
