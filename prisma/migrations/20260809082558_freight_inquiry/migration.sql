-- AlterEnum
ALTER TYPE "InquiryType" ADD VALUE 'FREIGHT_QUOTE';

-- CreateTable
CREATE TABLE "FreightInquiry" (
    "id" UUID NOT NULL,
    "inquiryId" UUID NOT NULL,
    "mode" "ShipmentMode" NOT NULL,
    "incoterm" "Incoterm",
    "originCountry" TEXT NOT NULL,
    "originCity" TEXT,
    "originPort" TEXT,
    "destinationCountry" TEXT NOT NULL,
    "destinationCity" TEXT,
    "destinationPort" TEXT,
    "cargoDescription" TEXT NOT NULL,
    "weightKg" DECIMAL(12,2),
    "volumeCbm" DECIMAL(12,2),
    "containerType" TEXT,
    "isHazardous" BOOLEAN NOT NULL DEFAULT false,
    "readyDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreightInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FreightInquiry_inquiryId_key" ON "FreightInquiry"("inquiryId");

-- AddForeignKey
ALTER TABLE "FreightInquiry" ADD CONSTRAINT "FreightInquiry_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "ContactInquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
