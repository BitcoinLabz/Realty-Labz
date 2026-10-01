-- Broker oversight (2026-10-01).
--
-- Additive only. sharedWithBrokerage defaults to true, so every existing
-- transaction stays exactly as visible to its brokerage as before; nothing
-- changes until an agent switches one off.

ALTER TABLE "deals" ADD COLUMN "sharedWithBrokerage" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "office_tasks" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "note" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dealId" TEXT NOT NULL,

    CONSTRAINT "office_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "office_tasks_dealId_idx" ON "office_tasks"("dealId");

ALTER TABLE "office_tasks" ADD CONSTRAINT "office_tasks_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
