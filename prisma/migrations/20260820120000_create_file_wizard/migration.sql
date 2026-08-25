-- AlterEnum
ALTER TYPE "DealSide" ADD VALUE 'TENANT';
ALTER TYPE "DealSide" ADD VALUE 'LANDLORD';

-- AlterTable
ALTER TABLE "deals" ALTER COLUMN "propertyAddress" DROP NOT NULL;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN "emailDeadlineReminders" BOOLEAN NOT NULL DEFAULT true;
