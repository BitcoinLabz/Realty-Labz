-- CreateEnum
CREATE TYPE "FormFieldAutoFillSource" AS ENUM ('CLIENT_NAME', 'CLIENT_EMAIL', 'CLIENT_PHONE', 'DEAL_PROPERTY_ADDRESS', 'DEAL_MLS_NUMBER', 'DEAL_LIST_PRICE', 'DEAL_SALE_PRICE', 'DEAL_CLOSING_DATE');

-- AlterTable
ALTER TABLE "form_fields" ADD COLUMN     "autoFillSource" "FormFieldAutoFillSource";
