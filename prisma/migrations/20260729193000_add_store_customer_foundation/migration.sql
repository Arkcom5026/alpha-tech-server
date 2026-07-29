-- Additive store-owned customer foundation.
-- CustomerProfile remains the active legacy runtime authority in this increment.

CREATE TYPE "StoreCustomerIdentityLinkStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'REVOKED');
CREATE TYPE "StoreCustomerIdentityVerificationMethod" AS ENUM (
  'OTP',
  'AUTHENTICATED_SESSION',
  'STAFF_ASSISTED',
  'MIGRATION_REVIEW'
);

CREATE TABLE "StoreCustomer" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "displayName" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "type" "CustomerType" NOT NULL DEFAULT 'INDIVIDUAL',
  "companyName" TEXT,
  "taxId" TEXT,
  "addressDetail" TEXT,
  "subdistrictCode" TEXT,
  "creditLimit" DECIMAL(12,2) DEFAULT 0,
  "paymentTerms" INTEGER,
  "internalNote" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreCustomer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreCustomer_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StoreCustomer_subdistrictCode_fkey"
    FOREIGN KEY ("subdistrictCode") REFERENCES "Subdistrict"("code") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "StoreCustomer_branchId_active_idx" ON "StoreCustomer"("branchId", "active");
CREATE INDEX "StoreCustomer_branchId_displayName_idx" ON "StoreCustomer"("branchId", "displayName");
CREATE INDEX "StoreCustomer_branchId_phone_idx" ON "StoreCustomer"("branchId", "phone");
CREATE INDEX "StoreCustomer_branchId_email_idx" ON "StoreCustomer"("branchId", "email");
CREATE INDEX "StoreCustomer_branchId_taxId_idx" ON "StoreCustomer"("branchId", "taxId");
CREATE INDEX "StoreCustomer_subdistrictCode_idx" ON "StoreCustomer"("subdistrictCode");

CREATE TABLE "StoreCustomerIdentityLink" (
  "id" SERIAL NOT NULL,
  "storeCustomerId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "status" "StoreCustomerIdentityLinkStatus" NOT NULL DEFAULT 'PENDING',
  "verificationMethod" "StoreCustomerIdentityVerificationMethod",
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreCustomerIdentityLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreCustomerIdentityLink_storeCustomerId_fkey"
    FOREIGN KEY ("storeCustomerId") REFERENCES "StoreCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StoreCustomerIdentityLink_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "StoreCustomerIdentityLink_storeCustomerId_userId_key"
  ON "StoreCustomerIdentityLink"("storeCustomerId", "userId");
CREATE INDEX "StoreCustomerIdentityLink_userId_status_idx"
  ON "StoreCustomerIdentityLink"("userId", "status");
CREATE INDEX "StoreCustomerIdentityLink_storeCustomerId_status_idx"
  ON "StoreCustomerIdentityLink"("storeCustomerId", "status");
