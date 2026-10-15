-- AlterEnum
ALTER TYPE "DrawStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Draw" ADD COLUMN     "lastError" TEXT;

-- AlterTable
ALTER TABLE "DrawSession" ADD COLUMN     "drawDelayMinutes" INTEGER,
ADD COLUMN     "number" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "checkoutUrl" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "DrawSession_number_key" ON "DrawSession"("number");

-- CreateIndex
CREATE INDEX "Payment_status_expiresAt_idx" ON "Payment"("status", "expiresAt");
