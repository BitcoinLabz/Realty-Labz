-- CreateEnum
CREATE TYPE "TransactionScope" AS ENUM ('BUSINESS', 'PERSONAL');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('STOCKS', 'RETIREMENT', 'REAL_ESTATE', 'CRYPTO', 'SAVINGS', 'OTHER');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "scope" "TransactionScope" NOT NULL DEFAULT 'BUSINESS',
ALTER COLUMN "category" DROP NOT NULL;

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "currentValue" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
