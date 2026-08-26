-- Mileage rates move from (state, year) to (state, effectiveFrom).
-- The IRS raised the standard rate mid-year on 2026-07-01, which a year-keyed
-- table structurally cannot express.

-- AlterTable: add the effective date, backfilled from the year it replaced
-- (an annual rate took effect on Jan 1 of that year).
ALTER TABLE "mileage_rates" ADD COLUMN "effectiveFrom" DATE;
UPDATE "mileage_rates" SET "effectiveFrom" = make_date("year", 1, 1) WHERE "effectiveFrom" IS NULL;
ALTER TABLE "mileage_rates" ALTER COLUMN "effectiveFrom" SET NOT NULL;

-- Replace the year-based uniqueness with date-based
DROP INDEX IF EXISTS "mileage_rates_state_year_key";
ALTER TABLE "mileage_rates" DROP COLUMN "year";
CREATE UNIQUE INDEX "mileage_rates_state_effectiveFrom_key" ON "mileage_rates"("state", "effectiveFrom");

-- The new IRS rate, effective 2026-07-01
INSERT INTO "mileage_rates" ("id", "state", "effectiveFrom", "ratePerMile")
VALUES ('mi_rate_2026_07_01', 'MI', DATE '2026-07-01', 0.760)
ON CONFLICT ("state", "effectiveFrom") DO UPDATE SET "ratePerMile" = 0.760;

-- Re-rate trips taken on or after the change that were logged under the old
-- rate. Each mileage_logs row stores the rate it was valued at, so trips
-- before 2026-07-01 are deliberately left untouched and keep 0.725.
-- Personal trips are never deductible, so their deduction stays 0.
UPDATE "mileage_logs"
SET "ratePerMile" = 0.760,
    "deduction" = CASE WHEN "isBusiness" THEN ROUND("miles" * 0.760, 2) ELSE 0 END
WHERE "date" >= TIMESTAMP '2026-07-01 00:00:00'
  AND "ratePerMile" <> 0.760;
