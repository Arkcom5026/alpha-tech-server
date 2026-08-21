CREATE TYPE "DeliveryNoteDocumentState" AS ENUM ('CURRENT', 'SUPERSEDED', 'CONSOLIDATED', 'CANCELLED');
CREATE TYPE "DeliveryNoteRevisionKind" AS ENUM ('ORIGINAL', 'RETURN_ADJUSTMENT');
CREATE TYPE "DeliveryNoteSourceLineType" AS ENUM ('STOCK', 'SIMPLE');

CREATE TABLE "DeliveryNoteDocument" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "saleId" INTEGER NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "revisionKind" "DeliveryNoteRevisionKind" NOT NULL,
    "state" "DeliveryNoteDocumentState" NOT NULL DEFAULT 'CURRENT',
    "replacesDocumentId" INTEGER,
    "currentKey" TEXT,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "returnedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "activeAmount" DECIMAL(12,2) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),
    "consolidatedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdById" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryNoteDocument_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DeliveryNoteDocument_revisionNumber_check" CHECK ("revisionNumber" > 0),
    CONSTRAINT "DeliveryNoteDocument_amounts_check" CHECK ("grossAmount" >= 0 AND "returnedAmount" >= 0 AND "activeAmount" >= 0),
    CONSTRAINT "DeliveryNoteDocument_currentKey_check" CHECK (
      ("state" = 'CURRENT' AND "currentKey" IS NOT NULL)
      OR ("state" <> 'CURRENT' AND "currentKey" IS NULL)
    )
);

CREATE TABLE "DeliveryNoteDocumentLine" (
    "id" SERIAL NOT NULL,
    "deliveryNoteDocumentId" INTEGER NOT NULL,
    "sourceLineType" "DeliveryNoteSourceLineType" NOT NULL,
    "sourceLineId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "originalQuantity" DECIMAL(12,2) NOT NULL,
    "returnedQuantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "activeQuantity" DECIMAL(12,2) NOT NULL,
    "unitAmount" DECIMAL(12,2) NOT NULL,
    "originalAmount" DECIMAL(12,2) NOT NULL,
    "returnedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "activeAmount" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryNoteDocumentLine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DeliveryNoteDocumentLine_quantities_check" CHECK (
      "originalQuantity" >= 0 AND "returnedQuantity" >= 0 AND "activeQuantity" >= 0
    ),
    CONSTRAINT "DeliveryNoteDocumentLine_amounts_check" CHECK (
      "unitAmount" >= 0 AND "originalAmount" >= 0 AND "returnedAmount" >= 0 AND "activeAmount" >= 0
    )
);

CREATE TABLE "DeliveryNoteDocumentReturnSource" (
    "id" SERIAL NOT NULL,
    "deliveryNoteDocumentId" INTEGER NOT NULL,
    "saleReturnId" INTEGER NOT NULL,
    "returnedAt" TIMESTAMP(3) NOT NULL,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryNoteDocumentReturnSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeliveryNoteDocument_documentNumber_key" ON "DeliveryNoteDocument"("documentNumber");
CREATE UNIQUE INDEX "DeliveryNoteDocument_replacesDocumentId_key" ON "DeliveryNoteDocument"("replacesDocumentId");
CREATE UNIQUE INDEX "DeliveryNoteDocument_currentKey_key" ON "DeliveryNoteDocument"("currentKey");
CREATE UNIQUE INDEX "DeliveryNoteDocument_branchId_saleId_revisionNumber_key" ON "DeliveryNoteDocument"("branchId", "saleId", "revisionNumber");
CREATE INDEX "DeliveryNoteDocument_branchId_saleId_state_idx" ON "DeliveryNoteDocument"("branchId", "saleId", "state");
CREATE INDEX "DeliveryNoteDocument_branchId_issuedAt_idx" ON "DeliveryNoteDocument"("branchId", "issuedAt");
CREATE INDEX "DeliveryNoteDocument_saleId_revisionNumber_idx" ON "DeliveryNoteDocument"("saleId", "revisionNumber");

CREATE UNIQUE INDEX "DeliveryNoteDocumentLine_deliveryNoteDocumentId_sourceLineType_sourceLineId_key"
  ON "DeliveryNoteDocumentLine"("deliveryNoteDocumentId", "sourceLineType", "sourceLineId");
CREATE INDEX "DeliveryNoteDocumentLine_sourceLineType_sourceLineId_idx"
  ON "DeliveryNoteDocumentLine"("sourceLineType", "sourceLineId");

CREATE UNIQUE INDEX "DeliveryNoteDocumentReturnSource_deliveryNoteDocumentId_saleReturnId_key"
  ON "DeliveryNoteDocumentReturnSource"("deliveryNoteDocumentId", "saleReturnId");
CREATE INDEX "DeliveryNoteDocumentReturnSource_saleReturnId_idx"
  ON "DeliveryNoteDocumentReturnSource"("saleReturnId");

ALTER TABLE "DeliveryNoteDocument"
  ADD CONSTRAINT "DeliveryNoteDocument_replacesDocumentId_fkey"
  FOREIGN KEY ("replacesDocumentId") REFERENCES "DeliveryNoteDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeliveryNoteDocumentLine"
  ADD CONSTRAINT "DeliveryNoteDocumentLine_deliveryNoteDocumentId_fkey"
  FOREIGN KEY ("deliveryNoteDocumentId") REFERENCES "DeliveryNoteDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeliveryNoteDocumentReturnSource"
  ADD CONSTRAINT "DeliveryNoteDocumentReturnSource_deliveryNoteDocumentId_fkey"
  FOREIGN KEY ("deliveryNoteDocumentId") REFERENCES "DeliveryNoteDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
