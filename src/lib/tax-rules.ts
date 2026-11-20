// Date-based lookup over the tax rules table (2026-11-19). Pure: callers
// pass in the rows (loaded once per request by src/lib/tax-rules-db.ts, or
// built from TAX_RULE_SEEDS in tests), so every calculation that depends on
// a rate stays unit-testable without a database.
//
// Same "most recent effectiveFrom on or before the date" rule as the mileage
// rate lookup (src/lib/mileage-rate.ts), and the same UTC-timestamp
// comparison, so a value on the exact changeover date lands on the right
// side of it.

import { TAX_RULE_SEEDS, type TaxRuleKey } from "@/lib/tax-rules-data";

export type TaxRuleRow = {
  jurisdiction: string;
  key: string;
  effectiveFrom: Date;
  value: number;
};

export class MissingTaxRuleError extends Error {}

export class TaxRules {
  private readonly rows: TaxRuleRow[];

  constructor(rows: TaxRuleRow[]) {
    this.rows = rows;
  }

  /** The value in effect on `onDate`, or null if this jurisdiction has none. */
  find(jurisdiction: string, key: TaxRuleKey, onDate: Date): number | null {
    const at = onDate.getTime();
    let applicable: TaxRuleRow | null = null;
    let earliest: TaxRuleRow | null = null;
    for (const row of this.rows) {
      if (row.jurisdiction !== jurisdiction || row.key !== key) continue;
      const from = row.effectiveFrom.getTime();
      if (from <= at && (!applicable || from > applicable.effectiveFrom.getTime())) applicable = row;
      if (!earliest || from < earliest.effectiveFrom.getTime()) earliest = row;
    }
    // A date before every row falls back to the earliest one, like mileage:
    // better a slightly-old rate than refusing to estimate a back-dated year.
    return (applicable ?? earliest)?.value ?? null;
  }

  /** Like find(), but a missing federal/state rule is a configuration bug. */
  get(jurisdiction: string, key: TaxRuleKey, onDate: Date): number {
    const value = this.find(jurisdiction, key, onDate);
    if (value === null) {
      throw new MissingTaxRuleError(`No tax rule ${jurisdiction}/${key}. Run the tax_rules migration or prisma/seed.ts.`);
    }
    return value;
  }
}

/** Rates are annual: a tax year's values are the ones in effect on Jan 1. */
export function taxYearDate(year: number): Date {
  return new Date(Date.UTC(year, 0, 1));
}

export function seedRowsToRules(): TaxRuleRow[] {
  return TAX_RULE_SEEDS.map((r) => ({
    jurisdiction: r.jurisdiction,
    key: r.key,
    effectiveFrom: new Date(`${r.effectiveFrom}T00:00:00.000Z`),
    value: r.value,
  }));
}
