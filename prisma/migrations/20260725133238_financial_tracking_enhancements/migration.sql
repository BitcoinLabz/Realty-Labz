-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionCategory" ADD VALUE 'MARKETING_ADVERTISING';
ALTER TYPE "TransactionCategory" ADD VALUE 'MLS_DUES';
ALTER TYPE "TransactionCategory" ADD VALUE 'CONTINUING_EDUCATION';
ALTER TYPE "TransactionCategory" ADD VALUE 'CLIENT_GIFTS';
ALTER TYPE "TransactionCategory" ADD VALUE 'OFFICE_SUPPLIES';
ALTER TYPE "TransactionCategory" ADD VALUE 'SOFTWARE_SUBSCRIPTIONS';
ALTER TYPE "TransactionCategory" ADD VALUE 'INSURANCE';
ALTER TYPE "TransactionCategory" ADD VALUE 'LICENSING_FEES';
ALTER TYPE "TransactionCategory" ADD VALUE 'MEALS_ENTERTAINMENT';
ALTER TYPE "TransactionCategory" ADD VALUE 'PROFESSIONAL_SERVICES';

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "brokerageSplitPercent" DECIMAL(5,2),
ADD COLUMN     "otherDeductions" DECIMAL(12,2),
ADD COLUMN     "referralFeeAmount" DECIMAL(12,2),
ADD COLUMN     "teamSplitAmount" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "dealId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "homeOfficeSqFt" INTEGER;

-- CreateTable
CREATE TABLE "asset_value_snapshots" (
    "id" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "asset_value_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "scope" "TransactionScope" NOT NULL,
    "category" "TransactionCategory",
    "monthlyLimit" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_goals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetAmount" DECIMAL(12,2) NOT NULL,
    "currentAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "targetDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedAssetId" TEXT,

    CONSTRAINT "financial_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_transaction_templates" (
    "id" TEXT NOT NULL,
    "scope" "TransactionScope" NOT NULL,
    "type" "TransactionType" NOT NULL,
    "category" "TransactionCategory",
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "frequency" "RecurringFrequency" NOT NULL,
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "lastLoggedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "recurring_transaction_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "budgets_userId_scope_category_key" ON "budgets"("userId", "scope", "category");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_value_snapshots" ADD CONSTRAINT "asset_value_snapshots_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_goals" ADD CONSTRAINT "financial_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_goals" ADD CONSTRAINT "financial_goals_linkedAssetId_fkey" FOREIGN KEY ("linkedAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_transaction_templates" ADD CONSTRAINT "recurring_transaction_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
