-- AlterTable
ALTER TABLE "public"."Product" ADD COLUMN     "branchId" INTEGER;

-- CreateIndex
CREATE INDEX "Product_branchId_idx" ON "public"."Product"("branchId");

-- CreateIndex
CREATE INDEX "Product_branchId_active_idx" ON "public"."Product"("branchId", "active");

-- CreateIndex
CREATE INDEX "Product_branchId_productTypeId_idx" ON "public"."Product"("branchId", "productTypeId");

-- CreateIndex
CREATE INDEX "Product_branchId_templateProductId_idx" ON "public"."Product"("branchId", "templateProductId");

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

