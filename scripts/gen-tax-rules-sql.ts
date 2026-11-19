// Prints INSERT statements for every row in TAX_RULE_SEEDS -- used once to
// write a tax_rules migration. Run: npx tsx scripts/gen-tax-rules-sql.ts
import { TAX_RULE_SEEDS } from "../src/lib/tax-rules-data";

const esc = (s: string) => s.replace(/'/g, "''");
for (const r of TAX_RULE_SEEDS) {
  const id = `tr_${r.jurisdiction}_${r.key}_${r.effectiveFrom}`.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  console.log(
    `INSERT INTO "tax_rules" ("id", "jurisdiction", "key", "effectiveFrom", "value", "source") VALUES ('${id}', '${r.jurisdiction}', '${r.key}', '${r.effectiveFrom}', ${r.value}, '${esc(r.source)}') ON CONFLICT ("jurisdiction", "key", "effectiveFrom") DO NOTHING;`,
  );
}
