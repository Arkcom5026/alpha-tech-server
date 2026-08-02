CREATE TYPE "TaxIssuerProfileStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED');

CREATE TABLE "TaxIssuerProfile" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "legalName" TEXT,
  "taxId" VARCHAR(13),
  "registeredAddress" TEXT,
  "branchCode" VARCHAR(5) NOT NULL DEFAULT '00000',
  "isHeadOffice" BOOLEAN NOT NULL DEFAULT false,
  "shortTaxInvoicePrefix" TEXT,
  "fullTaxInvoicePrefix" TEXT,
  "nextShortTaxInvoiceNumber" INTEGER NOT NULL DEFAULT 1,
  "nextFullTaxInvoiceNumber" INTEGER NOT NULL DEFAULT 1,
  "status" "TaxIssuerProfileStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TaxIssuerProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaxIssuerProfile_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TaxIssuerProfile_nextShortTaxInvoiceNumber_positive"
    CHECK ("nextShortTaxInvoiceNumber" > 0),
  CONSTRAINT "TaxIssuerProfile_nextFullTaxInvoiceNumber_positive"
    CHECK ("nextFullTaxInvoiceNumber" > 0)
);

CREATE UNIQUE INDEX "TaxIssuerProfile_branchId_key"
  ON "TaxIssuerProfile"("branchId");

CREATE INDEX "TaxIssuerProfile_status_idx"
  ON "TaxIssuerProfile"("status");
