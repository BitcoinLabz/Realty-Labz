import { cache } from "react";
import { prisma } from "@/lib/db";
import { TaxRules } from "@/lib/tax-rules";

// Loads the whole tax_rules table (a few dozen rows) once per request and
// hands it to the pure lookup in tax-rules.ts. Kept apart from that module so
// it stays importable from client components.
export const loadTaxRules = cache(async (): Promise<TaxRules> => {
  const rows = await prisma.taxRule.findMany();
  return new TaxRules(
    rows.map((r) => ({
      jurisdiction: r.jurisdiction,
      key: r.key,
      effectiveFrom: r.effectiveFrom,
      value: Number(r.value),
    })),
  );
});
