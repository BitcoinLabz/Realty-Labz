-- License numbers, and what a brokerage keeps when an agent leaves.
--
-- Entirely additive: four nullable columns, two unique indexes, one FK.
-- Order-independent against the deploy -- nothing breaks between running
-- this and shipping the code, in either order.
--
-- Every column is NULLABLE on purpose. Existing accounts have no license
-- number and existing teams have no brokerage number, so NOT NULL would
-- fail outright. Postgres allows many NULLs under a unique index, so
-- uniqueness still holds for everyone who does set one.

ALTER TABLE "users" ADD COLUMN "licenseNumber" TEXT;
ALTER TABLE "users" ADD COLUMN "teamJoinedAt" TIMESTAMP(3);

ALTER TABLE "teams" ADD COLUMN "brokerageNumber" TEXT;

ALTER TABLE "deals" ADD COLUMN "archivedTeamId" TEXT;

CREATE UNIQUE INDEX "users_licenseNumber_key" ON "users"("licenseNumber");
CREATE UNIQUE INDEX "teams_brokerageNumber_key" ON "teams"("brokerageNumber");
CREATE INDEX "deals_archivedTeamId_idx" ON "deals"("archivedTeamId");

-- SET NULL, not CASCADE: if a brokerage is ever deleted, the agent's deal
-- must survive it. The archive is the brokerage's copy of a record the
-- agent owns, never the other way round.
ALTER TABLE "deals" ADD CONSTRAINT "deals_archivedTeamId_fkey"
  FOREIGN KEY ("archivedTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
