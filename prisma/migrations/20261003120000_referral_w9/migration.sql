-- Referral partners: W-9 on file (2026-10-03). Additive, defaults false.

-- AlterTable
ALTER TABLE "referral_partners" ADD COLUMN     "w9Received" BOOLEAN NOT NULL DEFAULT false;

