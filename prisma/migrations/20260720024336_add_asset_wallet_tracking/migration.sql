-- CreateEnum
CREATE TYPE "WalletNetwork" AS ENUM ('BITCOIN', 'STACKS');

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "walletAddress" TEXT,
ADD COLUMN     "walletBalance" DECIMAL(24,8),
ADD COLUMN     "walletBalanceCheckedAt" TIMESTAMP(3),
ADD COLUMN     "walletNetwork" "WalletNetwork";
