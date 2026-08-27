-- Referral fee, team split, and other deductions become PERCENTAGES of the
-- commission, matching brokerageSplitPercent, instead of flat dollar figures.
--
-- Existing rows are converted to their equivalent percentage so each deal's
-- net commission is preserved rather than silently reinterpreted -- a stored
-- 500 meaning "$500" would otherwise become "500%".

-- AlterTable: rename first, convert while the column is still wide enough
-- (12,2) to hold the old dollar values mid-conversion.
ALTER TABLE "deals" RENAME COLUMN "referralFeeAmount" TO "referralFeePercent";
ALTER TABLE "deals" RENAME COLUMN "teamSplitAmount" TO "teamSplitPercent";
ALTER TABLE "deals" RENAME COLUMN "otherDeductions" TO "otherDeductionsPercent";

-- Dollars -> percent of gross commission, capped at 100 (a split exceeding
-- the whole commission is not meaningful and would overflow DECIMAL(5,2)).
UPDATE "deals"
SET
  "referralFeePercent" = LEAST(ROUND("referralFeePercent" / "commissionAmount" * 100, 2), 100),
  "teamSplitPercent" = LEAST(ROUND("teamSplitPercent" / "commissionAmount" * 100, 2), 100),
  "otherDeductionsPercent" = LEAST(ROUND("otherDeductionsPercent" / "commissionAmount" * 100, 2), 100)
WHERE "commissionAmount" IS NOT NULL AND "commissionAmount" > 0;

-- With no gross commission recorded, a dollar split had no meaningful share to
-- convert (net commission was already nonsense), so clear it rather than carry
-- a number that would now read as a percentage.
UPDATE "deals"
SET
  "referralFeePercent" = NULL,
  "teamSplitPercent" = NULL,
  "otherDeductionsPercent" = NULL
WHERE "commissionAmount" IS NULL OR "commissionAmount" = 0;

-- Narrow to the same precision as brokerageSplitPercent now that the values
-- are all percentages.
ALTER TABLE "deals" ALTER COLUMN "referralFeePercent" TYPE DECIMAL(5,2);
ALTER TABLE "deals" ALTER COLUMN "teamSplitPercent" TYPE DECIMAL(5,2);
ALTER TABLE "deals" ALTER COLUMN "otherDeductionsPercent" TYPE DECIMAL(5,2);
