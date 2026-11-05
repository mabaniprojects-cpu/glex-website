-- CreateEnum
CREATE TYPE "PackingMethod" AS ENUM ('CARTON', 'WOODEN_CRATE', 'WOODEN_BOX', 'PALLET_SHRINK_WRAPPED', 'PALLET_STRAPPED', 'BUNDLE', 'COIL', 'ROLL', 'DRUM', 'BAG', 'BIG_BAG_FIBC', 'IBC_TOTE', 'LOOSE_BULK');

-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('SUPPLIER_SHEET', 'SUPPLIER_PORTAL', 'MANUAL', 'QUOTATION');

-- AlterTable
ALTER TABLE "SupplierProfile" ADD COLUMN     "loadingPort" TEXT;

-- CreateTable
CREATE TABLE "ProductPrice" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "supplierId" UUID,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "incoterm" "Incoterm" NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL,
    "minQuantity" DECIMAL(14,3),
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "source" "PriceSource" NOT NULL,
    "sourceFileId" UUID,
    "note" TEXT,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPacking" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "method" "PackingMethod" NOT NULL,
    "unitsPerPack" DECIMAL(12,3),
    "unit" "UnitOfMeasure" NOT NULL,
    "lengthCm" DECIMAL(10,2),
    "widthCm" DECIMAL(10,2),
    "heightCm" DECIMAL(10,2),
    "grossWeightKg" DECIMAL(12,3),
    "packsPerPallet" INTEGER,
    "isStackable" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPacking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductPrice_productId_supersededAt_idx" ON "ProductPrice"("productId", "supersededAt");

-- CreateIndex
CREATE INDEX "ProductPrice_supplierId_idx" ON "ProductPrice"("supplierId");

-- CreateIndex
CREATE INDEX "ProductPrice_validUntil_idx" ON "ProductPrice"("validUntil");

-- CreateIndex
CREATE INDEX "ProductPacking_productId_idx" ON "ProductPacking"("productId");

-- AddForeignKey
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SupplierProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPacking" ADD CONSTRAINT "ProductPacking_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
