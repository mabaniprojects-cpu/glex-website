-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "glexCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Product_glexCode_key" ON "Product"("glexCode");
