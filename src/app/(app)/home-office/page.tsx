import Link from "next/link";
import {
  Calculator,
  ClipboardCheck,
  Download,
  House,
  Landmark,
  Receipt,
  Ruler,
  Smartphone,
  TrendingDown,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { HelpTip } from "@/components/ui/help-tip";
import { PageHeader } from "@/components/ui/page-header";
import { SummaryCard } from "@/components/ui/summary-card";
import { YearSelect } from "@/components/ui/year-select";
import { formatCurrency } from "@/lib/format";
import { businessUsePercent, countableAmount, depreciationBasis, formatDateOnlyUtc, recaptureEstimate } from "@/lib/home-office";
import { getHomeOfficeData, saveHomeOfficeSnapshots } from "@/lib/home-office-data";
import { loadTaxRules } from "@/lib/tax-rules-db";
import { chooseHomeOfficeMethodAction } from "@/app/actions/home-office";
import { SetupForm, type SetupValues } from "./setup-form";
import { EligibilityForm } from "./eligibility-form";
import { ExpensesSection, type ExpenseRow } from "./expenses-section";
import { MortgageHelper } from "./mortgage-helper";
import { StatusBanner } from "./status-banner";

const str = (v: { toString(): string } | null | undefined) => (v == null ? "" : String(v));
const ymd = (d: Date | null) => (d ? formatDateOnlyUtc(d) : "");
const answer = (v: boolean | null | undefined) => (v === true ? "yes" : v === false ? "no" : "") as "yes" | "no" | "";

export default async function HomeOfficePage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const session = await auth();
  const userId = session!.user.id;
  const currentYear = new Date().getFullYear();
  const { year: yearParam } = await searchParams;
  const year = Number(yearParam) || currentYear;

  const [data, expenses, mortgage, rules] = await Promise.all([
    getHomeOfficeData(userId, year),
    prisma.homeOfficeExpense.findMany({
      where: { userId, date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
      include: { receipt: { select: { id: true, fileName: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    // Prefill the mortgage splitter from a mortgage already tracked under Loans.
    prisma.loan.findFirst({ where: { userId, type: "MORTGAGE" }, orderBy: { createdAt: "desc" } }),
    loadTaxRules(),
  ]);

  // Keep the per-year carryover snapshot current (the running balance).
  if (data.chain.length > 0) await saveHomeOfficeSnapshots(userId, data.chain);

  const { row, profile, current, chain, overTime } = data;
  const ownership = row?.ownership ?? "OWN";
  const pct = profile ? businessUsePercent(profile) : null;
  const basis = profile ? depreciationBasis(profile) : null;
  const firstYear = row?.businessUseStart?.getUTCFullYear() ?? currentYear;
  const yearOptions = Array.from(
    new Set([currentYear, currentYear - 1, currentYear - 2, ...chain.map((c) => c.year)]),
  ).sort((a, b) => b - a);

  const setupValues: SetupValues = {
    officeLengthFt: str(row?.officeLengthFt),
    officeWidthFt: str(row?.officeWidthFt),
    officeSqFt: str(row?.officeSqFt),
    homeSqFt: str(row?.homeSqFt),
    businessUseStart: ymd(row?.businessUseStart ?? null),
    ownership,
    purchasePrice: str(row?.purchasePrice),
    landValue: str(row?.landValue),
    improvementsCost: str(row?.improvementsCost),
    fairMarketValueAtStart: str(row?.fairMarketValueAtStart),
  };

  const expenseRows: ExpenseRow[] = expenses.map((e) => ({
    id: e.id,
    kind: e.kind,
    scope: e.scope,
    period: e.period,
    date: ymd(e.date),
    amount: Number(e.amount),
    description: e.description,
    receipt: e.receipt,
    counted:
      countableAmount(
        { kind: e.kind, scope: e.scope, period: e.period, date: e.date, amount: Number(e.amount) },
        year,
        row?.businessUseStart ?? null,
      ) > 0,
  }));

  const firstPayment = mortgage ? new Date(mortgage.startDate) : null;
  if (firstPayment) firstPayment.setUTCMonth(firstPayment.getUTCMonth() + 1);
  const mortgagePrefill = {
    loanAmount: mortgage ? String(Number(mortgage.purchasePrice) - Number(mortgage.downPayment)) : "",
    ratePercent: str(mortgage?.interestRate),
    termMonths: str(mortgage?.termMonths),
    firstPaymentMonth: firstPayment ? firstPayment.toISOString().slice(0, 7) : "",
    annualTax: mortgage ? str(mortgage.annualPropertyTax) : "",
    annualInsurance: mortgage ? str(mortgage.annualInsurance) : "",
  };

  const anyNo = row ? [row.regularUse, row.exclusiveUse, row.principalPlace].includes(false) : false;
  const regular = current?.regular;
  const accumulated = current?.accumulatedDepreciation ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Home Office"
        description="Deduct the part of your home you use for your real estate business. Michigan follows the federal rules."
        action={
          <div className="flex items-center gap-2">
            <YearSelect year={year} options={yearOptions} basePath="/home-office" />
            {current ? (
              <a
                href={`/api/reports/home-office?year=${year}`}
                className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-surface px-4 text-sm font-medium text-foreground transition-colors hover:bg-border/40"
              >
                <Download size={15} />
                PDF report
              </a>
            ) : null}
          </div>
        }
      />

      {anyNo ? (
        <p className="rounded-2xl border border-warning/30 bg-warning/10 px-5 py-4 text-sm text-warning">
          Based on your eligibility answers, this space may not qualify for a home office deduction. Review them below
          and check with your accountant before claiming it.
        </p>
      ) : null}

      {current ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard
              label={`Deduction for ${year}`}
              value={formatCurrency(current.allowed)}
              icon={House}
              tone="success"
              hint="What you can deduct this year, after the rule that a home office can't turn a profit into a loss."
            />
            <SummaryCard
              label="Method"
              value={current.method === "REGULAR" ? "Regular" : "Simplified"}
              icon={Calculator}
              hint="Simplified is a flat $5 per square foot. Regular uses your actual home costs (IRS Form 8829)."
            />
            <SummaryCard
              label="Business use"
              value={pct != null ? `${(pct * 100).toFixed(1)}%` : `${profile?.officeSqFt ?? 0} sq ft`}
              icon={Ruler}
              hint="Your office's share of the home. Add your home's square footage to see it."
            />
          </div>
          <StatusBanner result={current} />
        </>
      ) : null}

      {current && overTime ? (
        <Card
          title="Which method should you use?"
          icon={Calculator}
          description={current.recommendationReason}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(["SIMPLIFIED", "REGULAR"] as const).map((method) => {
              const isSimplified = method === "SIMPLIFIED";
              const thisYear = isSimplified ? current.simplified.allowed : current.regular.allowed;
              const total = isSimplified ? overTime.simplifiedTotal : overTime.regularTotal;
              const inUse = current.method === method;
              return (
                <div
                  key={method}
                  className={`flex flex-col gap-3 rounded-xl border p-5 ${inUse ? "border-accent bg-accent/5" : "border-border"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{isSimplified ? "Simplified" : "Regular (Form 8829)"}</p>
                    {current.recommended === method ? (
                      <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted">
                    {isSimplified
                      ? "$5 per sq ft, up to 300 sq ft. No receipts to total, no depreciation, nothing carried forward."
                      : "Your share of real home costs plus depreciation. Unused amounts carry forward."}
                  </p>
                  <dl className="flex flex-col gap-1 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">{year}</dt>
                      <dd className="font-semibold tabular-nums text-foreground">{formatCurrency(thisYear)}</dd>
                    </div>
                    {overTime.years > 1 ? (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">
                          {firstYear}–{year} total
                        </dt>
                        <dd className="tabular-nums text-foreground">{formatCurrency(total)}</dd>
                      </div>
                    ) : null}
                    {!isSimplified && overTime.regularCarryOut > 0 ? (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">Saved for future years</dt>
                        <dd className="tabular-nums text-foreground">{formatCurrency(overTime.regularCarryOut)}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <form action={chooseHomeOfficeMethodAction} className="mt-auto">
                    <input type="hidden" name="year" value={year} />
                    <input type="hidden" name="method" value={inUse && current.methodWasChosen ? "" : method} />
                    <button
                      type="submit"
                      disabled={inUse && !current.methodWasChosen}
                      className="min-h-11 w-full rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-default disabled:border-transparent disabled:text-accent disabled:hover:bg-transparent"
                    >
                      {inUse
                        ? current.methodWasChosen
                          ? "Using this · go back to recommended"
                          : "Using this (recommended)"
                        : `Use ${isSimplified ? "simplified" : "regular"} for ${year}`}
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
          {current.tentativeProfit > 0 && current.simplified.lostToIncomeLimit > 0 && current.method === "SIMPLIFIED" ? (
            <p className="mt-4 text-sm text-warning">
              Your business didn&apos;t earn enough to use the full simplified deduction. The unused{" "}
              {formatCurrency(current.simplified.lostToIncomeLimit)} is lost: the simplified method has no carryover.
            </p>
          ) : null}
          {current.method === "SIMPLIFIED" && ownership === "OWN" ? (
            <p className="mt-4 text-sm text-muted">
              With the simplified method, mortgage interest and property taxes stay on your personal return (Schedule A)
              if you itemize.
            </p>
          ) : null}
        </Card>
      ) : null}

      <Card
        title={row ? "Your home office" : "Set up your home office"}
        icon={Ruler}
        description="Measure the room you use only for work. Everything else is worked out for you."
      >
        <SetupForm key={`${row?.updatedAt.toISOString() ?? "new"}:${setupValues.businessUseStart}`} values={setupValues} />
      </Card>

      <Card
        title="Does your space qualify?"
        icon={ClipboardCheck}
        description="The IRS allows a home office deduction only when all three are true."
      >
        <EligibilityForm
          key={row?.updatedAt.toISOString() ?? "new"}
          answers={{
            regularUse: answer(row?.regularUse),
            exclusiveUse: answer(row?.exclusiveUse),
            principalPlace: answer(row?.principalPlace),
          }}
        />
      </Card>

      <Card
        title={`Home costs for ${year}`}
        icon={Receipt}
        description="Bills for the whole home or just the office. These matter for the regular method; keep receipts either way."
      >
        {row ? (
          <ExpensesSection year={year} ownership={ownership} expenses={expenseRows} />
        ) : (
          <p className="rounded-xl bg-surface px-4 py-3 text-sm text-muted">
            Save your office details above, then you can add costs and receipts here.
          </p>
        )}
      </Card>

      {row && ownership === "OWN" ? (
        <Card
          title="Mortgage payment splitter"
          icon={Landmark}
          description="Your payment mixes four things. Only the interest is a mortgage deduction; principal never is."
        >
          <MortgageHelper year={year} prefill={mortgagePrefill} />
        </Card>
      ) : null}

      {regular && current ? (
        <Card
          title="How the regular method adds up"
          icon={Calculator}
          description="The Form 8829 order: mortgage interest and taxes first, then operating costs, then depreciation. Each step only uses the business income left after the one before."
        >
          <div className="flex flex-col gap-2 text-sm">
            <Line label="Business profit before home office" value={current.tentativeProfit} />
            <Line label="Income available for home office (not below $0)" value={regular.incomeLimit} />
            <Section title="1. Mortgage interest & real estate taxes" />
            <Line label="Office-only costs" value={regular.tierOne.direct} indent />
            <Line label={`Whole-home costs × ${(regular.businessPercent * 100).toFixed(1)}%`} value={regular.tierOne.indirect * regular.businessPercent} indent />
            <Line label="Allowed (even in a loss year)" value={regular.tierOne.businessShare} strong />
            <Line label="Income left" value={regular.afterTierOne} muted />
            <Section title="2. Operating costs (utilities, insurance, repairs, HOA, rent)" />
            <Line label="Office-only costs" value={regular.tierTwo.direct} indent />
            <Line label={`Whole-home costs × ${(regular.businessPercent * 100).toFixed(1)}%`} value={regular.tierTwo.indirect * regular.businessPercent} indent />
            <Line label="Carried in from last year" value={regular.tierTwo.carryIn} indent />
            <Line label="Allowed" value={regular.tierTwo.allowed} strong />
            <Line label="Income left" value={regular.afterTierTwo} muted />
            <Section title="3. Depreciation" />
            <Line label={`${year} depreciation`} value={regular.tierThree.depreciation} indent />
            <Line label="Carried in from last year" value={regular.tierThree.carryIn} indent />
            <Line label="Allowed" value={regular.tierThree.allowed} strong />
            <div className="mt-2 border-t border-border pt-2">
              <Line label="Regular method total" value={regular.allowed} strong />
              <Line label="Carried forward to next year" value={regular.carryOut.operating + regular.carryOut.depreciation} />
            </div>
          </div>
        </Card>
      ) : null}

      {basis && current && profile?.businessUseStart ? (
        <Card
          title="Depreciation"
          icon={TrendingDown}
          description="The office's share of the building (not the land) is written off over 39 years."
        >
          <div className="flex flex-col gap-2 text-sm">
            <Line label="Purchase price + improvements − land" value={basis.adjustedBasis} />
            {basis.fairMarketBuildingValue != null ? (
              <Line label="Market value when business use began − land" value={basis.fairMarketBuildingValue} />
            ) : null}
            <Line label="Basis (the lower of the two)" value={basis.basis} />
            <Line label={`Office share (${(basis.businessPercent * 100).toFixed(1)}%)`} value={basis.businessBasis} strong />
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="pb-2 font-medium">Year</th>
                  <th className="pb-2 text-right font-medium">Depreciation</th>
                  <th className="pb-2 text-right font-medium">Deducted</th>
                  <th className="pb-2 text-right font-medium">Total deducted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {chain.map((c) => (
                  <tr key={c.year}>
                    <td className="py-2 text-foreground">
                      {c.year}
                      {c.method === "SIMPLIFIED" ? <span className="ml-1 text-xs text-muted">(simplified)</span> : null}
                    </td>
                    <td className="py-2 text-right tabular-nums text-foreground">{formatCurrency(c.regular.tierThree.depreciation)}</td>
                    <td className="py-2 text-right tabular-nums text-foreground">{formatCurrency(c.depreciationTaken)}</td>
                    <td className="py-2 text-right tabular-nums text-foreground">{formatCurrency(c.accumulatedDepreciation)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {accumulated > 0 ? (
            <p className="mt-4 rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
              When you sell this home, the {formatCurrency(accumulated)} of depreciation deducted so far may be taxed
              (up to {formatCurrency(recaptureEstimate(accumulated, year, rules))} at 25%), even if the rest of your gain
              is tax-free under the home sale exclusion.
            </p>
          ) : null}
        </Card>
      ) : null}

      {chain.length > 0 ? (
        <Card
          title="Carryover balance"
          icon={Calculator}
          description="Amounts your income couldn't cover are saved and used automatically in your next profitable year (regular method only)."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="pb-2 font-medium">Year</th>
                  <th className="pb-2 font-medium">Method</th>
                  <th className="pb-2 text-right font-medium">Deducted</th>
                  <th className="pb-2 text-right font-medium">Carried in</th>
                  <th className="pb-2 text-right font-medium">Carried out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {chain.map((c) => (
                  <tr key={c.year} className={c.year === year ? "font-medium" : ""}>
                    <td className="py-2 text-foreground">{c.year}</td>
                    <td className="py-2 text-muted">{c.method === "REGULAR" ? "Regular" : "Simplified"}</td>
                    <td className="py-2 text-right tabular-nums text-foreground">{formatCurrency(c.allowed)}</td>
                    <td className="py-2 text-right tabular-nums text-foreground">
                      {formatCurrency(c.carryIn.operating + c.carryIn.depreciation)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-foreground">
                      {formatCurrency(c.carryOut.operating + c.carryOut.depreciation)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card
        title="Phone & internet"
        icon={Smartphone}
        description="These don't use your office's square footage. Deduct the share you use for work as a regular business expense instead."
      >
        <p className="text-sm text-muted">
          Add your phone or internet bill as a recurring cost on{" "}
          <Link href="/finances/income" className="font-medium text-accent hover:opacity-80">
            Income &amp; expenses
          </Link>{" "}
          and turn on <span className="font-medium text-foreground">Split by business use</span> (for example 60% work).
          The business share is logged each month automatically.
        </p>
      </Card>

      {ownership === "OWN" ? (
        <p className="flex items-start gap-1.5 px-1 text-sm text-muted">
          <span>
            <span className="font-medium text-foreground">Michigan property tax:</span> your Principal Residence
            Exemption (homestead) covers the part of your home you live in. A room used only for business can affect
            the exemption percentage, so mention it to your assessor or accountant.
          </span>
          <HelpTip text="The Principal Residence Exemption (PRE) lowers school operating taxes on the home you live in. It's a property tax matter, separate from your income tax." />
        </p>
      ) : null}
    </div>
  );
}

function Section({ title }: { title: string }) {
  return <p className="mt-3 font-medium text-foreground">{title}</p>;
}

function Line({
  label,
  value,
  strong,
  muted,
  indent,
}: {
  label: string;
  value: number;
  strong?: boolean;
  muted?: boolean;
  indent?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${indent ? "pl-3" : ""}`}>
      <span className={strong ? "text-foreground" : "text-muted"}>{label}</span>
      <span
        className={`shrink-0 tabular-nums ${strong ? "font-semibold text-foreground" : muted ? "text-muted" : "text-foreground"}`}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}
