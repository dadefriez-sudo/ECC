-- AlterTable
ALTER TABLE "User" ADD COLUMN     "iapPlatform" TEXT,
ADD COLUMN     "iapTransactionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_iapTransactionId_key" ON "User"("iapTransactionId");

