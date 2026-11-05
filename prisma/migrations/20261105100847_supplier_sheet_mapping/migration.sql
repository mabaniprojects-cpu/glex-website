-- CreateTable
CREATE TABLE "SupplierSheetMapping" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "sheetName" TEXT NOT NULL,
    "headerRow" INTEGER NOT NULL DEFAULT 1,
    "columns" JSONB NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierSheetMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierSheetMapping_supplierId_key" ON "SupplierSheetMapping"("supplierId");

-- AddForeignKey
ALTER TABLE "SupplierSheetMapping" ADD CONSTRAINT "SupplierSheetMapping_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "SupplierProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
