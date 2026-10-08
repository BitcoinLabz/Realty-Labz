-- "Choose your plan" after sign-up (2026-10-08). Defaults true, so existing
-- accounts are never sent to the plan picker; new sign-ups set it false.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "planChosen" BOOLEAN NOT NULL DEFAULT true;

