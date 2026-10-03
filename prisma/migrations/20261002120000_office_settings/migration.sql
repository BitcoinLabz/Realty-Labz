-- Office settings (2026-10-02): paperwork list, standard office checklist,
-- vendor directory, vendors on files, and the broker morning email opt-out.
--
-- Additive only: new tables, one nullable FK column on documents, and one
-- boolean defaulted true on users. Nothing existing changes.

-- CreateEnum
CREATE TYPE "VendorKind" AS ENUM ('TITLE', 'LENDER', 'INSPECTOR', 'APPRAISER', 'SIGNS', 'OTHER');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "requirementId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dailyDigest" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "required_documents" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sides" "DealSide"[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "required_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "office_checklist_items" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "office_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "kind" "VendorKind" NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_vendors" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dealId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,

    CONSTRAINT "deal_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "required_documents_teamId_idx" ON "required_documents"("teamId");

-- CreateIndex
CREATE INDEX "office_checklist_items_teamId_idx" ON "office_checklist_items"("teamId");

-- CreateIndex
CREATE INDEX "vendors_teamId_idx" ON "vendors"("teamId");

-- CreateIndex
CREATE INDEX "deal_vendors_vendorId_idx" ON "deal_vendors"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "deal_vendors_dealId_vendorId_key" ON "deal_vendors"("dealId", "vendorId");

-- CreateIndex
CREATE INDEX "documents_requirementId_idx" ON "documents"("requirementId");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "required_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "required_documents" ADD CONSTRAINT "required_documents_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "office_checklist_items" ADD CONSTRAINT "office_checklist_items_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_vendors" ADD CONSTRAINT "deal_vendors_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_vendors" ADD CONSTRAINT "deal_vendors_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

