-- Partner Store Application Provisioning
-- Additive authority only. No existing POS business data is copied or modified.

ALTER TABLE "PartnerStoreApplication"
  ADD COLUMN "provisionedBranchId" INTEGER,
  ADD COLUMN "provisionedOwnerUserId" INTEGER,
  ADD COLUMN "decidedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "PartnerStoreApplication_provisionedBranchId_key"
  ON "PartnerStoreApplication"("provisionedBranchId");

CREATE UNIQUE INDEX "PartnerStoreApplication_provisionedOwnerUserId_key"
  ON "PartnerStoreApplication"("provisionedOwnerUserId");

ALTER TABLE "PartnerStoreApplication"
  ADD CONSTRAINT "PartnerStoreApplication_provisionedBranchId_fkey"
  FOREIGN KEY ("provisionedBranchId") REFERENCES "Branch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PartnerStoreApplication"
  ADD CONSTRAINT "PartnerStoreApplication_provisionedOwnerUserId_fkey"
  FOREIGN KEY ("provisionedOwnerUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
