-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "shareCount" DECIMAL(14,4),
ADD COLUMN     "stockPriceCheckedAt" TIMESTAMP(3),
ADD COLUMN     "stockPricePerShare" DECIMAL(12,4),
ADD COLUMN     "stockTicker" TEXT;
