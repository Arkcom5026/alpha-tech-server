-- CreateEnum
CREATE TYPE "public"."WarrantyClaimRepairLinkState" AS ENUM ('UNLINKED_LEGACY', 'LINKED_VERIFIED', 'MANUAL_REVIEW_REQUIRED');

-- AlterTable
ALTER TABLE "public"."RepairJob" ALTER COLUMN "customerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."WarrantyClaim" ADD COLUMN     "repairLinkState" "public"."WarrantyClaimRepairLinkState" NOT NULL DEFAULT 'UNLINKED_LEGACY',
ADD COLUMN     "saleReturnItemId" INTEGER,
ALTER COLUMN "repairJobId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "WarrantyClaim_saleReturnItemId_idx" ON "public"."WarrantyClaim"("saleReturnItemId");

-- CreateIndex
CREATE INDEX "WarrantyClaim_repairLinkState_openedAt_idx" ON "public"."WarrantyClaim"("repairLinkState", "openedAt");

-- AddForeignKey
ALTER TABLE "public"."WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_saleReturnItemId_fkey" FOREIGN KEY ("saleReturnItemId") REFERENCES "public"."SaleReturnItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

