-- CreateEnum
CREATE TYPE "RfqWorkflowStage" AS ENUM ('INTAKE', 'SUPPLY_CHAIN', 'PRICING', 'COMPILATION', 'APPROVAL', 'READY_TO_SEND', 'SENT');

-- CreateEnum
CREATE TYPE "RfqTrackStatus" AS ENUM ('PENDING', 'TECHNICAL_REVIEW', 'TECHNICAL_DONE', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "RfqOrderClass" AS ENUM ('ORDINARY', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "RfqWorkflowTrack" AS ENUM ('INTAKE', 'SUPPLY_CHAIN', 'PROCUREMENT', 'TECHNICAL', 'SHIPPING', 'COMPILATION', 'APPROVAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'CUSTOMER_SERVICE';
ALTER TYPE "UserRole" ADD VALUE 'SUPPLY_CHAIN_MANAGER';
ALTER TYPE "UserRole" ADD VALUE 'PMO_TECHNICAL';
ALTER TYPE "UserRole" ADD VALUE 'LOGISTICS_SUPPORT';
ALTER TYPE "UserRole" ADD VALUE 'ACCOUNTANT';

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "invoiceReference" TEXT,
ADD COLUMN     "invoicedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RFQ" ADD COLUMN     "estimatedValueUsd" DECIMAL(14,2),
ADD COLUMN     "orderClass" "RfqOrderClass",
ADD COLUMN     "procurementStatus" "RfqTrackStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "shippingStatus" "RfqTrackStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "technicalDueAt" TIMESTAMP(3),
ADD COLUMN     "workflowStage" "RfqWorkflowStage" NOT NULL DEFAULT 'INTAKE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "invitedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RFQWorkflowEntry" (
    "id" UUID NOT NULL,
    "rfqId" UUID NOT NULL,
    "track" "RfqWorkflowTrack" NOT NULL,
    "authorId" UUID,
    "note" TEXT,
    "fileId" UUID,
    "amount" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RFQWorkflowEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RFQWorkflowEntry_rfqId_createdAt_idx" ON "RFQWorkflowEntry"("rfqId", "createdAt");

-- CreateIndex
CREATE INDEX "RFQ_workflowStage_idx" ON "RFQ"("workflowStage");

-- AddForeignKey
ALTER TABLE "RFQWorkflowEntry" ADD CONSTRAINT "RFQWorkflowEntry_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RFQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFQWorkflowEntry" ADD CONSTRAINT "RFQWorkflowEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RFQWorkflowEntry" ADD CONSTRAINT "RFQWorkflowEntry_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
