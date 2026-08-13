CREATE TYPE "PartnerStoreApplicationEventType" AS ENUM (
  'SUBMITTED',
  'REVIEW_STARTED',
  'APPROVED',
  'REJECTED',
  'WITHDRAWN'
);

CREATE TABLE "PartnerStoreApplicationEvent" (
  "id" SERIAL NOT NULL,
  "applicationId" INTEGER NOT NULL,
  "eventType" "PartnerStoreApplicationEventType" NOT NULL,
  "previousStatus" "PartnerStoreApplicationStatus",
  "resultingStatus" "PartnerStoreApplicationStatus" NOT NULL,
  "actorUserId" INTEGER,
  "note" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PartnerStoreApplicationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartnerStoreApplicationEvent_applicationId_createdAt_idx"
  ON "PartnerStoreApplicationEvent"("applicationId", "createdAt");

CREATE INDEX "PartnerStoreApplicationEvent_eventType_createdAt_idx"
  ON "PartnerStoreApplicationEvent"("eventType", "createdAt");

CREATE INDEX "PartnerStoreApplicationEvent_actorUserId_idx"
  ON "PartnerStoreApplicationEvent"("actorUserId");

ALTER TABLE "PartnerStoreApplicationEvent"
  ADD CONSTRAINT "PartnerStoreApplicationEvent_applicationId_fkey"
  FOREIGN KEY ("applicationId")
  REFERENCES "PartnerStoreApplication"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
