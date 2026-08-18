CREATE TABLE "SaleQuotationReference" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "saleId" INTEGER NOT NULL,
  "quotationId" INTEGER NOT NULL,
  "quotationCode" TEXT NOT NULL,
  "quotationRevision" INTEGER NOT NULL DEFAULT 0,
  "quotationIssuedAt" TIMESTAMP(3),
  "linkedById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SaleQuotationReference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SaleQuotationReference_saleId_quotationId_key"
  ON "SaleQuotationReference"("saleId", "quotationId");
CREATE INDEX "SaleQuotationReference_branchId_saleId_idx"
  ON "SaleQuotationReference"("branchId", "saleId");
CREATE INDEX "SaleQuotationReference_branchId_quotationId_idx"
  ON "SaleQuotationReference"("branchId", "quotationId");
CREATE INDEX "SaleQuotationReference_branchId_quotationCode_quotationRevision_idx"
  ON "SaleQuotationReference"("branchId", "quotationCode", "quotationRevision");

ALTER TABLE "SaleQuotationReference"
  ADD CONSTRAINT "SaleQuotationReference_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleQuotationReference"
  ADD CONSTRAINT "SaleQuotationReference_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleQuotationReference"
  ADD CONSTRAINT "SaleQuotationReference_quotationId_fkey"
  FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleQuotationReference"
  ADD CONSTRAINT "SaleQuotationReference_linkedById_fkey"
  FOREIGN KEY ("linkedById") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
