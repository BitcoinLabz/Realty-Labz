-- Ignore Stripe webhook events older than the last one applied (2026-11-20).
-- Nullable so existing accounts are unchanged until the next event.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "stripeEventAt" TIMESTAMP(3);
