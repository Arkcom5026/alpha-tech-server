-- Partner Store Application Foundation
-- Additive only. An application never creates a Branch or operating identity.

CREATE TYPE "PartnerStoreApplicationStatus" AS ENUM (
  'PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'WITHDRAWN'
);

CREATE TABLE "PartnerStoreApplication" (
  "id" SERIAL PRIMARY KEY,
  "applicationCode" TEXT NOT NULL UNIQUE,
  "businessName" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "contactPhone" TEXT NOT NULL,
  "contactEmail" TEXT,
  "businessAddress" TEXT,
  "requestedStorefrontSlug" TEXT,
  "note" TEXT,
  "status" "PartnerStoreApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "PartnerStoreApplication_status_createdAt_idx"
  ON "PartnerStoreApplication"("status", "createdAt");

CREATE INDEX "PartnerStoreApplication_contactPhone_createdAt_idx"
  ON "PartnerStoreApplication"("contactPhone", "createdAt");

CREATE INDEX "PartnerStoreApplication_requestedStorefrontSlug_idx"
  ON "PartnerStoreApplication"("requestedStorefrontSlug");
