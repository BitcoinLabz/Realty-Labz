-- DropForeignKey
ALTER TABLE "form_submissions" DROP CONSTRAINT "form_submissions_formTemplateId_fkey";

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_formTemplateId_fkey" FOREIGN KEY ("formTemplateId") REFERENCES "form_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
