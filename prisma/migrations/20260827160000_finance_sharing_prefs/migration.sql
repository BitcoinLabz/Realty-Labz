-- Per-agent control over what their brokerage can see from Finances.
--
-- Additive and defaulted to false, so running this changes nothing about
-- who can see what until an agent actively opts in. Order-independent
-- against the deploy.
--
-- Business data only. There is deliberately no column for personal
-- investments, loans, or PERSONAL-scoped transactions -- those stay
-- unqueryable by a manager (see CLAUDE.md Architecture Principles).

ALTER TABLE "users" ADD COLUMN "shareBusinessFinances" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "shareMileage" BOOLEAN NOT NULL DEFAULT false;
