CREATE TYPE "TaxCandidateStatus" AS ENUM ('REGISTERED', 'MAPPED', 'REJECTED', 'CONVERTED');

CREATE TABLE "TaxCandidate" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceDocumentNo" TEXT,
  "registrationKey" TEXT NOT NULL,
  "status" "TaxCandidateStatus" NOT NULL DEFAULT 'REGISTERED',
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "snapshot" JSONB NOT NULL DEFAULT '{}',
  "mappedDocumentType" TEXT,
  "rejectionCode" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxCandidate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaxCandidate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TaxCandidate_registrationKey_key" ON "TaxCandidate"("registrationKey");
CREATE UNIQUE INDEX "TaxCandidate_branchId_sourceType_sourceId_key" ON "TaxCandidate"("branchId", "sourceType", "sourceId");
CREATE INDEX "TaxCandidate_branchId_status_occurredAt_idx" ON "TaxCandidate"("branchId", "status", "occurredAt");
CREATE INDEX "TaxCandidate_sourceType_sourceId_idx" ON "TaxCandidate"("sourceType", "sourceId");

CREATE TABLE "TaxDocument" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "candidateId" INTEGER,
  "documentType" TEXT NOT NULL,
  "documentNumber" TEXT NOT NULL,
  "counterpartyTaxId" TEXT,
  "identityKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "issuedAt" TIMESTAMP(3),
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'THB',
  "subtotalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "snapshot" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaxDocument_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TaxDocument_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "TaxCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TaxDocument_identityKey_key" ON "TaxDocument"("identityKey");
CREATE UNIQUE INDEX "TaxDocument_candidateId_key" ON "TaxDocument"("candidateId");
CREATE INDEX "TaxDocument_branchId_status_occurredAt_idx" ON "TaxDocument"("branchId", "status", "occurredAt");
CREATE INDEX "TaxDocument_branchId_documentType_documentNumber_idx" ON "TaxDocument"("branchId", "documentType", "documentNumber");

CREATE TABLE "TaxDocumentLifecycleEvent" (
  "id" SERIAL NOT NULL,
  "taxDocumentId" INTEGER NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "reason" TEXT,
  "actorEmployeeId" INTEGER,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxDocumentLifecycleEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaxDocumentLifecycleEvent_taxDocumentId_fkey" FOREIGN KEY ("taxDocumentId") REFERENCES "TaxDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TaxDocumentLifecycleEvent_actorEmployeeId_fkey" FOREIGN KEY ("actorEmployeeId") REFERENCES "EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "TaxDocumentLifecycleEvent_taxDocumentId_occurredAt_idx" ON "TaxDocumentLifecycleEvent"("taxDocumentId", "occurredAt");
CREATE INDEX "TaxDocumentLifecycleEvent_actorEmployeeId_occurredAt_idx" ON "TaxDocumentLifecycleEvent"("actorEmployeeId", "occurredAt");
