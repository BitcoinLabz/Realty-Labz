// Commission disbursement (CDA) dollar lines (2026-10-02). Pure and tested
// (cda.test.ts): a form sent to the title company has to add up to the cent.
//
// Each split is a percentage of the gross commission (see commission.ts).
// Every share is rounded to cents on its own, and the agent's net is what's
// left -- so the lines always sum exactly to the gross, with any rounding
// penny landing on the agent rather than vanishing.

export type CdaSplits = {
  brokerageSplitPercent?: number | null;
  referralFeePercent?: number | null;
  teamSplitPercent?: number | null;
  otherDeductionsPercent?: number | null;
};

export type CdaLines = {
  gross: number;
  brokerage: number;
  referral: number;
  team: number;
  other: number;
  agentNet: number;
};

const toCents = (dollars: number) => Math.round(dollars * 100);
const share = (grossCents: number, percent: number | null | undefined) =>
  percent ? Math.round((grossCents * percent) / 100) : 0;

export function computeCdaLines(gross: number, splits: CdaSplits): CdaLines {
  const grossCents = toCents(gross);
  const brokerage = share(grossCents, splits.brokerageSplitPercent);
  const referral = share(grossCents, splits.referralFeePercent);
  const team = share(grossCents, splits.teamSplitPercent);
  const other = share(grossCents, splits.otherDeductionsPercent);
  const agentNet = grossCents - brokerage - referral - team - other;
  return {
    gross: grossCents / 100,
    brokerage: brokerage / 100,
    referral: referral / 100,
    team: team / 100,
    other: other / 100,
    agentNet: agentNet / 100,
  };
}
