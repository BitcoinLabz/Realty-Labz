import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { TAX_RULE_SEEDS } from "../src/lib/tax-rules-data";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// IRS standard mileage rates. Real estate agents deduct mileage using this
// federal rate; Michigan does not set its own separate rate.
//
// Each entry is the date a rate took effect, NOT a year -- the IRS raised the
// rate mid-year on 2026-07-01. Adding a future change means adding a row
// here (and inserting it in production); no code changes, and every already
// logged trip keeps the rate it was valued at.
//
// Dates are built as UTC midnight to match how trip dates are stored, so a
// trip on the exact changeover date lands on the right side of it.
const MILEAGE_RATES = [
  { effectiveFrom: new Date(Date.UTC(2026, 0, 1)), ratePerMile: 0.725 },
  { effectiveFrom: new Date(Date.UTC(2026, 6, 1)), ratePerMile: 0.76 },
];

async function main() {
  // Tax rules (2026-11-19): the migration inserts these too; the upsert keeps
  // a dev database in step after editing src/lib/tax-rules-data.ts.
  for (const r of TAX_RULE_SEEDS) {
    const effectiveFrom = new Date(`${r.effectiveFrom}T00:00:00.000Z`);
    await prisma.taxRule.upsert({
      where: { jurisdiction_key_effectiveFrom: { jurisdiction: r.jurisdiction, key: r.key, effectiveFrom } },
      update: { value: r.value, source: r.source },
      create: { jurisdiction: r.jurisdiction, key: r.key, effectiveFrom, value: r.value, source: r.source },
    });
  }

  for (const rate of MILEAGE_RATES) {
    await prisma.mileageRate.upsert({
      where: { state_effectiveFrom: { state: "MI", effectiveFrom: rate.effectiveFrom } },
      update: { ratePerMile: rate.ratePerMile },
      create: { state: "MI", effectiveFrom: rate.effectiveFrom, ratePerMile: rate.ratePerMile },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
