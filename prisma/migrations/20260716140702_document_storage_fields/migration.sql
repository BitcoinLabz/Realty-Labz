/*
  Warnings:

  - You are about to drop the column `fileUrl` on the `documents` table. All the data in the column will be lost.
  - Added the required column `mimeType` to the `documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storageKey` to the `documents` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "documents" DROP COLUMN "fileUrl",
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "size" INTEGER NOT NULL,
ADD COLUMN     "storageKey" TEXT NOT NULL;
