-- CreateTable
CREATE TABLE "client_deadlines" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "client_deadlines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_deadlines_clientId_idx" ON "client_deadlines"("clientId");

-- AddForeignKey
ALTER TABLE "client_deadlines" ADD CONSTRAINT "client_deadlines_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
