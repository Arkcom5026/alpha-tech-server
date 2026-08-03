-- AlterTable
ALTER TABLE "Product" ADD COLUMN "branchId" INTEGER;

-- CreateIndex
CREATE INDEX "Product_branchId_idx" ON "Product"("branchId");

-- CreateIndex
CREATE INDEX "Product_branchId_active_idx" ON "Product"("branchId", "active");

-- CreateIndex
CREATE INDEX "Product_branchId_productTypeId_idx" ON "Product"("branchId", "productTypeId");

-- CreateIndex
CREATE INDEX "Product_branchId_templateProductId_idx" ON "Product"("branchId", "templateProductId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
