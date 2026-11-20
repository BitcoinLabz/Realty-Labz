import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MICHIGAN_TAX_CITIES, TAX_RULE_SEEDS } from "./tax-rules-data";
import { MissingTaxRuleError, TaxRules, seedRowsToRules, taxYearDate } from "./tax-rules";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("TaxRules lookup", () => {
  const rules = new TaxRules([
    { jurisdiction: "MI", key: "STATE_INCOME_TAX_RATE", effectiveFrom: d("2023-01-01"), value: 0.0405 },
    { jurisdiction: "MI", key: "STATE_INCOME_TAX_RATE", effectiveFrom: d("2024-01-01"), value: 0.0425 },
  ]);

  it("picks the value in effect on the date", () => {
    expect(rules.get("MI", "STATE_INCOME_TAX_RATE", d("2023-06-30"))).toBe(0.0405);
    expect(rules.get("MI", "STATE_INCOME_TAX_RATE", d("2026-03-01"))).toBe(0.0425);
  });

  it("uses the new value on its exact effective date", () => {
    expect(rules.get("MI", "STATE_INCOME_TAX_RATE", d("2024-01-01"))).toBe(0.0425);
  });

  it("falls back to the earliest value for a date before every row", () => {
    expect(rules.get("MI", "STATE_INCOME_TAX_RATE", d("2010-01-01"))).toBe(0.0405);
  });

  it("returns null from find() and throws from get() when a rule is missing", () => {
    expect(rules.find("MI-NOWHERE", "CITY_RESIDENT_RATE", d("2026-01-01"))).toBeNull();
    expect(() => rules.get("US", "SE_MEDICARE_RATE", d("2026-01-01"))).toThrow(MissingTaxRuleError);
  });

  it("dates a tax year by Jan 1 UTC", () => {
    expect(taxYearDate(2026).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("seeded rules", () => {
  const rules = new TaxRules(seedRowsToRules());

  it("has the simplified home office numbers", () => {
    expect(rules.get("US", "HOME_OFFICE_SIMPLIFIED_RATE", taxYearDate(2026))).toBe(5);
    expect(rules.get("US", "HOME_OFFICE_SIMPLIFIED_MAX_SQFT", taxYearDate(2026))).toBe(300);
  });

  it("has a resident and nonresident rate for every Michigan tax city", () => {
    for (const city of MICHIGAN_TAX_CITIES) {
      expect(rules.find(`MI-${city.code}`, "CITY_RESIDENT_RATE", taxYearDate(2026))).toBe(city.resident);
      expect(rules.find(`MI-${city.code}`, "CITY_NONRESIDENT_RATE", taxYearDate(2026))).toBe(city.nonresident);
    }
  });

  it("has no duplicate (jurisdiction, key, date) rows", () => {
    const keys = TAX_RULE_SEEDS.map((r) => `${r.jurisdiction}|${r.key}|${r.effectiveFrom}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  // The app reads the database table; production gets its rows from the
  // migrations. If someone adds a rule to tax-rules-data.ts but forgets the
  // migration, production would silently lack it -- this catches that.
  it("every seeded rule is inserted by a migration", () => {
    const dir = join(process.cwd(), "prisma", "migrations");
    const sql = readdirSync(dir)
      .filter((name) => !name.endsWith(".toml"))
      .map((name) => {
        try {
          return readFileSync(join(dir, name, "migration.sql"), "utf8");
        } catch {
          return "";
        }
      })
      .join("\n");
    for (const r of TAX_RULE_SEEDS) {
      expect(sql, `${r.jurisdiction}/${r.key}/${r.effectiveFrom}`).toContain(
        `'${r.jurisdiction}', '${r.key}', '${r.effectiveFrom}', ${r.value},`,
      );
    }
  });
});
