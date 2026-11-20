// The canonical list of every tax rate, limit and threshold the app uses
// (2026-11-19). Pure data, no database import, so it can be read by the seed
// script, by tests, and by client components (the city picker).
//
// HOW THIS IS USED
// - Each row is copied into the `tax_rules` table by the migration that
//   created it and by `prisma/seed.ts` (an upsert, safe to re-run). The app
//   reads the TABLE at runtime (src/lib/tax-rules-db.ts), so a yearly change
//   is one new row with a new `effectiveFrom` -- no code change, and past
//   years keep the value that applied to them.
// - tax-rules-data.test.ts fails if a row here is missing from the
//   migration SQL, so the two can't quietly drift apart.
//
// ⚠️ HUMAN VERIFICATION REQUIRED EVERY YEAR ⚠️
// Every value below must be checked against its `source` each January (and
// whenever a law changes mid-year, as the IRS mileage rate did on
// 2026-07-01). Rows marked `verify: true` are values that were NOT
// confirmed against a primary source when added -- they are best-known
// figures and must be checked before anyone relies on them. To change a
// value: add a NEW row with the date it takes effect, here and in the
// production database. Never edit an old row: that rewrites past years.

export type TaxRuleSeed = {
  jurisdiction: string; // "US", "MI", or "MI-<CITY>" for Michigan cities
  key: TaxRuleKey;
  effectiveFrom: string; // yyyy-mm-dd
  value: number;
  source: string;
  verify?: boolean;
};

export type TaxRuleKey =
  // Federal self-employment tax (Schedule SE)
  | "SE_NET_EARNINGS_FACTOR"
  | "SE_SOCIAL_SECURITY_RATE"
  | "SE_MEDICARE_RATE"
  | "SOCIAL_SECURITY_WAGE_BASE"
  // Home office (Form 8829 / simplified method)
  | "HOME_OFFICE_SIMPLIFIED_RATE"
  | "HOME_OFFICE_SIMPLIFIED_MAX_SQFT"
  | "HOME_OFFICE_RECOVERY_YEARS"
  | "DEPRECIATION_RECAPTURE_MAX_RATE"
  // Hobby-loss presumption (IRC 183(d))
  | "HOBBY_LOSS_PROFIT_YEARS"
  | "HOBBY_LOSS_WINDOW_YEARS"
  // 1099-NEC/MISC reporting threshold for payments to a referral partner
  | "FORM_1099_THRESHOLD"
  // Michigan
  | "STATE_INCOME_TAX_RATE"
  | "STATE_PERSONAL_EXEMPTION"
  // Michigan cities (Uniform City Income Tax Act)
  | "CITY_RESIDENT_RATE"
  | "CITY_NONRESIDENT_RATE";

const IRS_SE = "IRS Schedule SE instructions";
const IRS_8829 = "IRS Publication 587 / Form 8829 instructions";
const MI_TREAS = "Michigan Department of Treasury, MI-1040 instructions";
const CITY_SRC = "Michigan Treasury city income tax list; confirm on the city's own tax forms";

const FEDERAL: TaxRuleSeed[] = [
  // 92.35% of net profit is subject to SE tax (Schedule SE line 4a).
  { jurisdiction: "US", key: "SE_NET_EARNINGS_FACTOR", effectiveFrom: "2000-01-01", value: 0.9235, source: IRS_SE },
  { jurisdiction: "US", key: "SE_SOCIAL_SECURITY_RATE", effectiveFrom: "2000-01-01", value: 0.124, source: IRS_SE },
  { jurisdiction: "US", key: "SE_MEDICARE_RATE", effectiveFrom: "2000-01-01", value: 0.029, source: IRS_SE },
  // Social Security tax stops at the wage base; Medicare doesn't.
  { jurisdiction: "US", key: "SOCIAL_SECURITY_WAGE_BASE", effectiveFrom: "2025-01-01", value: 176100, source: "SSA annual COLA announcement" },
  { jurisdiction: "US", key: "SOCIAL_SECURITY_WAGE_BASE", effectiveFrom: "2026-01-01", value: 184500, source: "SSA annual COLA announcement", verify: true },

  { jurisdiction: "US", key: "HOME_OFFICE_SIMPLIFIED_RATE", effectiveFrom: "2013-01-01", value: 5, source: "IRS Rev. Proc. 2013-13" },
  { jurisdiction: "US", key: "HOME_OFFICE_SIMPLIFIED_MAX_SQFT", effectiveFrom: "2013-01-01", value: 300, source: "IRS Rev. Proc. 2013-13" },
  // A home office is depreciated as nonresidential real property.
  { jurisdiction: "US", key: "HOME_OFFICE_RECOVERY_YEARS", effectiveFrom: "1993-05-13", value: 39, source: IRS_8829 },
  // "Unrecaptured section 1250 gain" is taxed at up to 25%.
  { jurisdiction: "US", key: "DEPRECIATION_RECAPTURE_MAX_RATE", effectiveFrom: "1997-05-07", value: 0.25, source: "IRS Publication 523" },

  { jurisdiction: "US", key: "HOBBY_LOSS_PROFIT_YEARS", effectiveFrom: "1986-01-01", value: 3, source: "IRC section 183(d), IRS Publication 535" },
  { jurisdiction: "US", key: "HOBBY_LOSS_WINDOW_YEARS", effectiveFrom: "1986-01-01", value: 5, source: "IRC section 183(d), IRS Publication 535" },

  // $600 through 2025; $2,000 for payments made from 2026 under the 2025
  // federal tax law, inflation-indexed after 2026 -- add a row each year.
  { jurisdiction: "US", key: "FORM_1099_THRESHOLD", effectiveFrom: "2000-01-01", value: 600, source: "IRS General Instructions for Information Returns" },
  { jurisdiction: "US", key: "FORM_1099_THRESHOLD", effectiveFrom: "2026-01-01", value: 2000, source: "IRS General Instructions for Information Returns", verify: true },
];

const MICHIGAN: TaxRuleSeed[] = [
  { jurisdiction: "MI", key: "STATE_INCOME_TAX_RATE", effectiveFrom: "2023-01-01", value: 0.0405, source: MI_TREAS },
  { jurisdiction: "MI", key: "STATE_INCOME_TAX_RATE", effectiveFrom: "2024-01-01", value: 0.0425, source: MI_TREAS, verify: true },
  // Per filer; the estimate assumes one exemption (no dependents).
  { jurisdiction: "MI", key: "STATE_PERSONAL_EXEMPTION", effectiveFrom: "2024-01-01", value: 5600, source: MI_TREAS },
  { jurisdiction: "MI", key: "STATE_PERSONAL_EXEMPTION", effectiveFrom: "2025-01-01", value: 5800, source: MI_TREAS, verify: true },
];

// Michigan cities that levy an income tax. Ann Arbor and Ypsilanti are NOT
// on this list: as far as we know neither levies one (Ypsilanti voters
// rejected it). If that changes, add a city here and in a new migration.
export const MICHIGAN_TAX_CITIES: { code: string; name: string; resident: number; nonresident: number }[] = [
  { code: "ALBION", name: "Albion", resident: 0.01, nonresident: 0.005 },
  { code: "BATTLE_CREEK", name: "Battle Creek", resident: 0.01, nonresident: 0.005 },
  { code: "BENTON_HARBOR", name: "Benton Harbor", resident: 0.01, nonresident: 0.005 },
  { code: "BIG_RAPIDS", name: "Big Rapids", resident: 0.01, nonresident: 0.005 },
  { code: "DETROIT", name: "Detroit", resident: 0.024, nonresident: 0.012 },
  { code: "EAST_LANSING", name: "East Lansing", resident: 0.01, nonresident: 0.005 },
  { code: "FLINT", name: "Flint", resident: 0.01, nonresident: 0.005 },
  { code: "GRAND_RAPIDS", name: "Grand Rapids", resident: 0.015, nonresident: 0.0075 },
  { code: "GRAYLING", name: "Grayling", resident: 0.01, nonresident: 0.005 },
  { code: "HAMTRAMCK", name: "Hamtramck", resident: 0.01, nonresident: 0.005 },
  { code: "HIGHLAND_PARK", name: "Highland Park", resident: 0.02, nonresident: 0.01 },
  { code: "HUDSON", name: "Hudson", resident: 0.01, nonresident: 0.005 },
  { code: "IONIA", name: "Ionia", resident: 0.01, nonresident: 0.005 },
  { code: "JACKSON", name: "Jackson", resident: 0.01, nonresident: 0.005 },
  { code: "LANSING", name: "Lansing", resident: 0.01, nonresident: 0.005 },
  { code: "LAPEER", name: "Lapeer", resident: 0.01, nonresident: 0.005 },
  { code: "MUSKEGON", name: "Muskegon", resident: 0.01, nonresident: 0.005 },
  { code: "MUSKEGON_HEIGHTS", name: "Muskegon Heights", resident: 0.01, nonresident: 0.005 },
  { code: "PONTIAC", name: "Pontiac", resident: 0.01, nonresident: 0.005 },
  { code: "PORT_HURON", name: "Port Huron", resident: 0.01, nonresident: 0.005 },
  { code: "PORTLAND", name: "Portland", resident: 0.01, nonresident: 0.005 },
  { code: "SAGINAW", name: "Saginaw", resident: 0.015, nonresident: 0.0075 },
  { code: "SPRINGFIELD", name: "Springfield", resident: 0.01, nonresident: 0.005 },
  { code: "WALKER", name: "Walker", resident: 0.01, nonresident: 0.005 },
];

export function cityJurisdiction(code: string): string {
  return `MI-${code}`;
}

const CITIES: TaxRuleSeed[] = MICHIGAN_TAX_CITIES.flatMap((c) => [
  { jurisdiction: cityJurisdiction(c.code), key: "CITY_RESIDENT_RATE" as const, effectiveFrom: "2024-01-01", value: c.resident, source: CITY_SRC, verify: true },
  { jurisdiction: cityJurisdiction(c.code), key: "CITY_NONRESIDENT_RATE" as const, effectiveFrom: "2024-01-01", value: c.nonresident, source: CITY_SRC, verify: true },
]);

export const TAX_RULE_SEEDS: TaxRuleSeed[] = [...FEDERAL, ...MICHIGAN, ...CITIES];

export function cityName(code: string | null | undefined): string | null {
  if (!code) return null;
  return MICHIGAN_TAX_CITIES.find((c) => c.code === code)?.name ?? null;
}
