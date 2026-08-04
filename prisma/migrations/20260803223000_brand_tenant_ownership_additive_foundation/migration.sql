-- AlterTable
ALTER TABLE "public"."Brand" ADD COLUMN     "branchId" INTEGER;

-- CreateIndex
CREATE INDEX "Brand_branchId_idx" ON "public"."Brand"("branchId");

-- CreateIndex
CREATE INDEX "Brand_branchId_active_idx" ON "public"."Brand"("branchId", "active");

-- CreateIndex
CREATE INDEX "Brand_branchId_normalizedName_idx" ON "public"."Brand"("branchId", "normalizedName");

-- AddForeignKey
ALTER TABLE "public"."Brand" ADD CONSTRAINT "Brand_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
