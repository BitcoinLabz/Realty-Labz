-- CreateEnum
CREATE TYPE "DealSide" AS ENUM ('BUYER', 'SELLER', 'DUAL');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('ACTIVE', 'UNDER_CONTRACT', 'PENDING', 'CLOSED', 'FELL_THROUGH');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "dealId" TEXT;

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "side" "DealSide" NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'ACTIVE',
    "propertyAddress" TEXT NOT NULL,
    "mlsNumber" TEXT,
    "listPrice" DECIMAL(12,2),
    "salePrice" DECIMAL(12,2),
    "commissionRate" DECIMAL(5,2),
    "commissionAmount" DECIMAL(12,2),
    "closingDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_deadlines" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dealId" TEXT NOT NULL,

    CONSTRAINT "deal_deadlines_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_deadlines" ADD CONSTRAINT "deal_deadlines_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
