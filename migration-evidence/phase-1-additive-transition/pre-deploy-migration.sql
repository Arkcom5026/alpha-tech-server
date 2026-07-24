-- CreateEnum
CREATE TYPE "public"."WarrantyClaimRepairLinkState" AS ENUM ('UNLINKED_LEGACY', 'LINKED_VERIFIED', 'MANUAL_REVIEW_REQUIRED');

-- AlterTable
ALTER TABLE "public"."WarrantyClaim" ADD COLUMN     "repairJobId" INTEGER,
ADD COLUMN     "repairLinkState" "public"."WarrantyClaimRepairLinkState" NOT NULL DEFAULT 'UNLINKED_LEGACY';

-- CreateIndex
CREATE INDEX "WarrantyClaim_repairJobId_openedAt_idx" ON "public"."WarrantyClaim"("repairJobId", "openedAt");

-- CreateIndex
CREATE INDEX "WarrantyClaim_repairLinkState_openedAt_idx" ON "public"."WarrantyClaim"("repairLinkState", "openedAt");

-- AddForeignKey
ALTER TABLE "public"."WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "public"."RepairJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
