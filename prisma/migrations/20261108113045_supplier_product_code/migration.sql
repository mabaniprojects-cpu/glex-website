-- CreateTable
CREATE TABLE "SupplierProductCode" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "sourceFileId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierProductCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierProductCode_productId_idx" ON "SupplierProductCode"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierProductCode_supplierId_code_key" ON "SupplierProductCode"("supplierId", "code");

-- AddForeignKey
ALTER TABLE "SupplierProductCode" ADD CONSTRAINT "SupplierProductCode_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProductCode" ADD CONSTRAINT "SupplierProductCode_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SupplierProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierProductCode" ADD CONSTRAINT "SupplierProductCode_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

