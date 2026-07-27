/*
  Warnings:

  - Added the required column `updatedAt` to the `recurring_transaction_templates` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "recurring_transaction_templates" ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- Backfill existing rows (createdAt is the closest known-good value) before
-- enforcing NOT NULL, since this table already has data in the shared
-- dev/prod database.
UPDATE "recurring_transaction_templates" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

ALTER TABLE "recurring_transaction_templates" ALTER COLUMN "updatedAt" SET NOT NULL;
