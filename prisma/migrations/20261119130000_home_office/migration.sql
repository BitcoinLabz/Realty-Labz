-- Home office module (2026-11-19). Additive only; copies each account's
-- simplified-method square footage into the new table so nobody loses it.

-- CreateEnum
CREATE TYPE "HomeOwnership" AS ENUM ('OWN', 'RENT');

-- CreateEnum
CREATE TYPE "HomeOfficeMethod" AS ENUM ('SIMPLIFIED', 'REGULAR');

-- CreateEnum
CREATE TYPE "HomeOfficeExpenseKind" AS ENUM ('MORTGAGE_INTEREST', 'REAL_ESTATE_TAX', 'INSURANCE', 'UTILITIES', 'RENT', 'REPAIRS', 'HOA', 'OTHER');

-- CreateEnum
CREATE TYPE "HomeOfficeExpenseScope" AS ENUM ('DIRECT', 'INDIRECT');

-- CreateEnum
CREATE TYPE "HomeOfficeExpensePeriod" AS ENUM ('MONTH', 'YEAR');

-- CreateTable
CREATE TABLE "home_offices" (
    "id" TEXT NOT NULL,
    "officeLengthFt" DECIMAL(7,2),
    "officeWidthFt" DECIMAL(7,2),
    "officeSqFt" INTEGER,
    "homeSqFt" INTEGER,
    "businessUseStart" DATE,
    "ownership" "HomeOwnership" NOT NULL DEFAULT 'OWN',
    "purchasePrice" DECIMAL(12,2),
    "landValue" DECIMAL(12,2),
    "improvementsCost" DECIMAL(12,2),
    "fairMarketValueAtStart" DECIMAL(12,2),
    "regularUse" BOOLEAN,
    "exclusiveUse" BOOLEAN,
    "principalPlace" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "home_offices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_office_expenses" (
    "id" TEXT NOT NULL,
    "kind" "HomeOfficeExpenseKind" NOT NULL,
    "scope" "HomeOfficeExpenseScope" NOT NULL DEFAULT 'INDIRECT',
    "period" "HomeOfficeExpensePeriod" NOT NULL DEFAULT 'MONTH',
    "date" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "receiptId" TEXT,

    CONSTRAINT "home_office_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_office_years" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "method" "HomeOfficeMethod",
    "appliedMethod" "HomeOfficeMethod",
    "allowedDeduction" DECIMAL(12,2),
    "operatingCarryoverIn" DECIMAL(12,2),
    "depreciationCarryoverIn" DECIMAL(12,2),
    "operatingCarryoverOut" DECIMAL(12,2),
    "depreciationCarryoverOut" DECIMAL(12,2),
    "depreciationTaken" DECIMAL(12,2),
    "computedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,

    CONSTRAINT "home_office_years_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "home_offices_userId_key" ON "home_offices"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "home_office_expenses_receiptId_key" ON "home_office_expenses"("receiptId");

-- CreateIndex
CREATE INDEX "home_office_expenses_userId_date_idx" ON "home_office_expenses"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "home_office_years_userId_year_key" ON "home_office_years"("userId", "year");

-- AddForeignKey
ALTER TABLE "home_offices" ADD CONSTRAINT "home_offices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_office_expenses" ADD CONSTRAINT "home_office_expenses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_office_expenses" ADD CONSTRAINT "home_office_expenses_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_office_years" ADD CONSTRAINT "home_office_years_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Carry existing setups across. businessUseStart stays null ("in use all
-- year"), which is exactly how the old simplified-only card behaved.
INSERT INTO "home_offices" ("id", "officeSqFt", "ownership", "createdAt", "updatedAt", "userId")
SELECT 'ho_' || "id", "homeOfficeSqFt", 'OWN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, "id"
FROM "users"
WHERE "homeOfficeSqFt" IS NOT NULL AND "homeOfficeSqFt" > 0;
