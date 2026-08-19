CREATE TABLE "DocumentPresentationSnapshot" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "sourceType" VARCHAR(64) NOT NULL,
    "sourceId" VARCHAR(128) NOT NULL,
    "documentPurpose" VARCHAR(64) NOT NULL,
    "rendererFamily" VARCHAR(32) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "snapshotHash" VARCHAR(64) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentPresentationSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentPresentationSnapshot_branchId_sourceType_sourceId_documentPurpose_rendererFamily_key"
ON "DocumentPresentationSnapshot"("branchId", "sourceType", "sourceId", "documentPurpose", "rendererFamily");

CREATE INDEX "DocumentPresentationSnapshot_branchId_documentPurpose_issuedAt_idx"
ON "DocumentPresentationSnapshot"("branchId", "documentPurpose", "issuedAt");

CREATE INDEX "DocumentPresentationSnapshot_sourceType_sourceId_idx"
ON "DocumentPresentationSnapshot"("sourceType", "sourceId");

ALTER TABLE "DocumentPresentationSnapshot"
ADD CONSTRAINT "DocumentPresentationSnapshot_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
