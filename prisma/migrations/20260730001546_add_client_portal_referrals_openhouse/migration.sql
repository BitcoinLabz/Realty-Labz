-- CreateEnum
CREATE TYPE "ClientSource" AS ENUM ('REFERRAL', 'ZILLOW', 'OPEN_HOUSE', 'SPHERE', 'WEBSITE', 'SOCIAL_MEDIA', 'OTHER');

-- CreateEnum
CREATE TYPE "ClientStage" AS ENUM ('NEW', 'CONTACTED', 'NURTURING', 'ACTIVE', 'CLOSED', 'LOST');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "source" "ClientSource",
ADD COLUMN     "stage" "ClientStage" NOT NULL DEFAULT 'NEW';

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "referralPartnerId" TEXT;

-- CreateTable
CREATE TABLE "client_portal_sessions" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "client_portal_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "referral_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "open_houses" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dealId" TEXT NOT NULL,

    CONSTRAINT "open_houses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "open_house_visitors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "interested" BOOLEAN,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openHouseId" TEXT NOT NULL,

    CONSTRAINT "open_house_visitors_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "client_portal_sessions" ADD CONSTRAINT "client_portal_sessions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_referralPartnerId_fkey" FOREIGN KEY ("referralPartnerId") REFERENCES "referral_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_partners" ADD CONSTRAINT "referral_partners_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "open_houses" ADD CONSTRAINT "open_houses_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "open_house_visitors" ADD CONSTRAINT "open_house_visitors_openHouseId_fkey" FOREIGN KEY ("openHouseId") REFERENCES "open_houses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
