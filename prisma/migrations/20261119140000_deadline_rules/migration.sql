-- Deadlines as rules, extension options and applied extensions (2026-11-19).
-- Additive: every existing deadline keeps its date and simply has no rule.

-- CreateEnum
CREATE TYPE "DeadlineBaseEvent" AS ENUM ('ACCEPTANCE', 'CLOSING', 'DEADLINE');

-- CreateEnum
CREATE TYPE "DeadlineDayType" AS ENUM ('CALENDAR', 'BUSINESS');

-- CreateEnum
CREATE TYPE "DeadlineCategory" AS ENUM ('INSPECTION', 'FINANCING', 'APPRAISAL', 'TITLE', 'SALE_OF_BUYERS_HOME', 'DUE_DILIGENCE', 'EARNEST_MONEY', 'CLOSING', 'OTHER');

-- AlterTable
ALTER TABLE "deal_deadlines" ADD COLUMN     "amount" DECIMAL(12,2),
ADD COLUMN     "baseDeadlineId" TEXT,
ADD COLUMN     "baseEvent" "DeadlineBaseEvent",
ADD COLUMN     "category" "DeadlineCategory",
ADD COLUMN     "dayType" "DeadlineDayType" NOT NULL DEFAULT 'CALENDAR',
ADD COLUMN     "extensionDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "offsetDays" INTEGER;

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "acceptanceDate" DATE;

-- CreateTable
CREATE TABLE "deal_extension_options" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "dayType" "DeadlineDayType" NOT NULL DEFAULT 'CALENDAR',
    "additionalDeposit" DECIMAL(12,2),
    "cost" DECIMAL(12,2),
    "exercisableBy" TEXT,
    "noticeText" TEXT,
    "noticeDate" DATE,
    "targetDeadlineIds" TEXT[],
    "sourceQuote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dealId" TEXT NOT NULL,

    CONSTRAINT "deal_extension_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_extensions" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "dayType" "DeadlineDayType" NOT NULL DEFAULT 'CALENDAR',
    "shifts" JSONB NOT NULL,
    "additionalDeposit" DECIMAL(12,2),
    "depositDeadlineId" TEXT,
    "note" TEXT,
    "appliedByName" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),
    "undoneByName" TEXT,
    "appliedById" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "optionId" TEXT,

    CONSTRAINT "deal_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deal_extension_options_dealId_idx" ON "deal_extension_options"("dealId");

-- CreateIndex
CREATE INDEX "deal_extensions_dealId_idx" ON "deal_extensions"("dealId");

-- AddForeignKey
ALTER TABLE "deal_deadlines" ADD CONSTRAINT "deal_deadlines_baseDeadlineId_fkey" FOREIGN KEY ("baseDeadlineId") REFERENCES "deal_deadlines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_extension_options" ADD CONSTRAINT "deal_extension_options_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_extensions" ADD CONSTRAINT "deal_extensions_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_extensions" ADD CONSTRAINT "deal_extensions_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_extensions" ADD CONSTRAINT "deal_extensions_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "deal_extension_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

