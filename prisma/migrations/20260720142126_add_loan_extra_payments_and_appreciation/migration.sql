-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "appreciationRate" DECIMAL(5,3) NOT NULL DEFAULT 3.5;

-- CreateTable
CREATE TABLE "loan_extra_payments" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loanId" TEXT NOT NULL,

    CONSTRAINT "loan_extra_payments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "loan_extra_payments" ADD CONSTRAINT "loan_extra_payments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
