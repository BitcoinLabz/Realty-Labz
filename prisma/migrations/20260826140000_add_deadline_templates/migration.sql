-- Reusable named sets of contingency deadlines, applied to a transaction with
-- one anchor date. Purely additive: two new tables, no existing table touched.

-- CreateTable
CREATE TABLE "deadline_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "deadline_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deadline_template_items" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "offsetDays" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "templateId" TEXT NOT NULL,

    CONSTRAINT "deadline_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deadline_templates_userId_idx" ON "deadline_templates"("userId");

-- CreateIndex
CREATE INDEX "deadline_template_items_templateId_idx" ON "deadline_template_items"("templateId");

-- AddForeignKey
ALTER TABLE "deadline_templates" ADD CONSTRAINT "deadline_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_template_items" ADD CONSTRAINT "deadline_template_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "deadline_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
