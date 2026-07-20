// Standard fixed-rate amortization math, built around a month-by-month
// schedule rather than closed-form formulas -- extra principal payments
// (2026-07-20) can land on any month and don't have a clean closed-form
// solution, so everything (current balance, payoff date, the paydown chart)
// derives from the same simulated schedule. Nothing here is persisted
// per-month (see the comment on the Loan model) -- it's recomputed on read.

export type ExtraPayment = { date: Date; amount: number };

export type SchedulePoint = {
  date: Date;
  monthIndex: number; // 0 = loan origination
  balance: number;
  interestPaid: number;
  principalPaid: number; // scheduled principal only, excludes extraPaid
  extraPaid: number;
};

function monthlyRate(annualRatePct: number): number {
  return annualRatePct / 100 / 12;
}

export function monthlyPayment(principal: number, annualRatePct: number, termMonths: number): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  if (annualRatePct === 0) return principal / termMonths;
  const r = monthlyRate(annualRatePct);
  const factor = Math.pow(1 + r, termMonths);
  return (principal * r * factor) / (factor - 1);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

// Builds the full month-by-month schedule from origination to payoff (or to
// termMonths if never paid off, which shouldn't happen for a positive rate).
// The scheduled P&I payment amount is fixed for the life of the loan --
// extra payments only ever pull the payoff date earlier, never change the
// required payment, matching how real fixed-rate loans work.
export function buildAmortizationSchedule(
  loanAmount: number,
  annualRatePct: number,
  termMonths: number,
  startDate: Date,
  extraPayments: ExtraPayment[] = [],
): SchedulePoint[] {
  const r = monthlyRate(annualRatePct);
  const basePayment = monthlyPayment(loanAmount, annualRatePct, termMonths);

  const extraByMonth = new Map<string, number>();
  for (const p of extraPayments) {
    const key = monthKey(p.date);
    extraByMonth.set(key, (extraByMonth.get(key) ?? 0) + p.amount);
  }

  const schedule: SchedulePoint[] = [
    { date: new Date(startDate), monthIndex: 0, balance: loanAmount, interestPaid: 0, principalPaid: 0, extraPaid: 0 },
  ];

  let balance = loanAmount;
  for (let i = 1; i <= termMonths && balance > 0.005; i++) {
    const date = addMonths(startDate, i);
    const interest = balance * r;
    let principal = basePayment - interest;
    if (principal > balance) principal = balance;
    balance = Math.max(0, balance - principal);

    const extra = extraByMonth.get(monthKey(date)) ?? 0;
    const appliedExtra = Math.min(extra, balance);
    balance -= appliedExtra;

    schedule.push({ date, monthIndex: i, balance, interestPaid: interest, principalPaid: principal, extraPaid: appliedExtra });
  }

  return schedule;
}

// The schedule point representing "as of today" -- the most recent point
// not in the future.
export function scheduleAtDate(schedule: SchedulePoint[], asOf: Date): SchedulePoint {
  let point = schedule[0];
  for (const p of schedule) {
    if (p.date > asOf) break;
    point = p;
  }
  return point;
}

export function payoffDate(schedule: SchedulePoint[]): Date {
  return schedule[schedule.length - 1].date;
}

// If currentValueOverride is given (e.g. a rehab added value beyond what
// pure appreciation from the purchase price would predict), the segment
// from asOfMonth forward re-anchors on that value and appreciates from
// there -- the historical segment before asOfMonth is left as the
// purchase-price estimate, since that's already happened and isn't what the
// override is meant to correct. Without an override this is exactly the
// original single-curve projection from purchase price.
export function buildHomeValueProjection(
  purchasePrice: number,
  appreciationRatePct: number,
  months: number,
  startDate: Date,
  currentValueOverride?: { value: number; asOfMonth: number },
): { date: Date; value: number }[] {
  const monthlyFactor = Math.pow(1 + appreciationRatePct / 100, 1 / 12);
  const points: { date: Date; value: number }[] = [];
  for (let i = 0; i <= months; i++) {
    const value =
      currentValueOverride && i >= currentValueOverride.asOfMonth
        ? currentValueOverride.value * Math.pow(monthlyFactor, i - currentValueOverride.asOfMonth)
        : purchasePrice * Math.pow(monthlyFactor, i);
    points.push({ date: addMonths(startDate, i), value });
  }
  return points;
}

// Both charts sample the schedule yearly rather than plotting every one of
// up to 360 monthly points -- plenty smooth for a multi-decade overview and
// keeps the x-axis readable.
export function buildPaydownChartData(
  originalSchedule: SchedulePoint[],
  actualSchedule: SchedulePoint[],
): { label: string; original: number; actual: number }[] {
  const maxMonth = originalSchedule[originalSchedule.length - 1].monthIndex;
  const points: { label: string; original: number; actual: number }[] = [];
  for (let m = 0; m <= maxMonth; m += 12) {
    const orig = originalSchedule[Math.min(m, originalSchedule.length - 1)];
    const actual = m < actualSchedule.length ? actualSchedule[m].balance : 0;
    points.push({ label: `Yr ${m / 12}`, original: orig.balance, actual });
  }
  return points;
}

export function buildEquityChartData(
  actualSchedule: SchedulePoint[],
  homeValueProjection: { date: Date; value: number }[],
  months: number,
): { label: string; homeValue: number; balance: number; equity: number }[] {
  const points: { label: string; homeValue: number; balance: number; equity: number }[] = [];
  for (let m = 0; m <= months; m += 12) {
    const balance = m < actualSchedule.length ? actualSchedule[m].balance : 0;
    const homeValue = homeValueProjection[Math.min(m, homeValueProjection.length - 1)].value;
    points.push({ label: `Yr ${m / 12}`, homeValue, balance, equity: homeValue - balance });
  }
  return points;
}

export type LoanSummary = {
  loanAmount: number;
  monthlyPrincipalAndInterest: number;
  monthlyTax: number;
  monthlyInsurance: number;
  totalMonthlyPayment: number;
  remainingBalance: number;
  isPaidOff: boolean;
  currentPrincipalPortion: number;
  currentInterestPortion: number;
  totalInterestOverLife: number;
  payoffDate: Date;
};

export function summarizeLoan(loan: {
  purchasePrice: number;
  downPayment: number;
  interestRate: number;
  termMonths: number;
  startDate: Date;
  annualPropertyTax: number;
  annualInsurance: number;
  extraPayments?: ExtraPayment[];
}): LoanSummary {
  const loanAmount = Math.max(0, loan.purchasePrice - loan.downPayment);
  const monthlyPrincipalAndInterest = monthlyPayment(loanAmount, loan.interestRate, loan.termMonths);
  const monthlyTax = loan.annualPropertyTax / 12;
  const monthlyInsurance = loan.annualInsurance / 12;

  const schedule = buildAmortizationSchedule(
    loanAmount,
    loan.interestRate,
    loan.termMonths,
    loan.startDate,
    loan.extraPayments ?? [],
  );

  const now = new Date();
  const current = scheduleAtDate(schedule, now);
  const isPaidOff = current.balance <= 0.005;

  const r = loan.interestRate / 100 / 12;
  const currentInterestPortion = isPaidOff ? 0 : current.balance * r;
  const currentPrincipalPortion = isPaidOff ? 0 : monthlyPrincipalAndInterest - currentInterestPortion;

  const totalInterestOverLife = schedule.reduce((sum, p) => sum + p.interestPaid, 0);

  return {
    loanAmount,
    monthlyPrincipalAndInterest,
    monthlyTax,
    monthlyInsurance,
    totalMonthlyPayment: monthlyPrincipalAndInterest + monthlyTax + monthlyInsurance,
    remainingBalance: current.balance,
    isPaidOff,
    currentPrincipalPortion,
    currentInterestPortion,
    totalInterestOverLife,
    payoffDate: payoffDate(schedule),
  };
}
