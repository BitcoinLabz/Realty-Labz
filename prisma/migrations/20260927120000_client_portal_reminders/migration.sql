-- Client portal upgrade: per-document visibility and automatic deadline
-- reminders.
--
-- Additive only. visibleToClient defaults to true, so every existing
-- document stays exactly as visible in the portal as it was before. The two
-- reminder stamps are nullable ("not sent yet").

ALTER TABLE "documents" ADD COLUMN "visibleToClient" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "deal_deadlines" ADD COLUMN "autoReminderEarlySentAt" TIMESTAMP(3);
ALTER TABLE "deal_deadlines" ADD COLUMN "autoReminderFinalSentAt" TIMESTAMP(3);
