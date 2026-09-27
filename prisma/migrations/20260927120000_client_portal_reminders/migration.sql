-- Client portal upgrade: per-document visibility and automatic deadline
-- reminders.
--
-- Additive only. visibleToClient defaults to true, so every existing
-- document stays exactly as visible in the portal as it was before. The two
-- reminder stamps are nullable ("not sent yet").

ALTER TABLE "documents" ADD COLUMN "visibleToClient" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "deal_deadlines" ADD COLUMN "autoReminderEarlySentAt" TIMESTAMP(3);
ALTER TABLE "deal_deadlines" ADD COLUMN "autoReminderFinalSentAt" TIMESTAMP(3);

-- Contract reader upgrade: where each deadline came from, and what it means
-- in plain words for the client. Both nullable -- deadlines added by hand or
-- from a deadline set simply don't have them.
ALTER TABLE "deal_deadlines" ADD COLUMN "sourceQuote" TEXT;
ALTER TABLE "deal_deadlines" ADD COLUMN "clientNote" TEXT;
