CREATE TYPE "CommunicationChannelType" AS ENUM ('PHONE', 'SMS', 'EMAIL', 'LINE', 'FACEBOOK', 'OTHER');
CREATE TYPE "CommunicationConsentStatus" AS ENUM ('UNKNOWN', 'GRANTED', 'REVOKED');

CREATE TABLE "CustomerContactChannel" (
  "id" SERIAL PRIMARY KEY, "branchId" INTEGER NOT NULL, "customerId" INTEGER NOT NULL,
  "channelType" "CommunicationChannelType" NOT NULL, "address" TEXT NOT NULL,
  "displayLabel" TEXT, "consentStatus" "CommunicationConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
  "verifiedAt" TIMESTAMP(3), "active" BOOLEAN NOT NULL DEFAULT true, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerContactChannel_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CustomerContactChannel_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CustomerContactChannel_branchId_customerId_channelType_address_key" ON "CustomerContactChannel"("branchId","customerId","channelType","address");
CREATE INDEX "CustomerContactChannel_branchId_customerId_active_idx" ON "CustomerContactChannel"("branchId","customerId","active");

CREATE TABLE "CommunicationProfile" (
  "id" SERIAL PRIMARY KEY, "branchId" INTEGER NOT NULL, "channelType" "CommunicationChannelType" NOT NULL,
  "displayName" TEXT NOT NULL, "address" TEXT, "publicUri" TEXT, "qrPayload" TEXT, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "integrationRef" TEXT, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunicationProfile_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CommunicationProfile_branchId_channelType_displayName_key" ON "CommunicationProfile"("branchId","channelType","displayName");
CREATE INDEX "CommunicationProfile_branchId_enabled_idx" ON "CommunicationProfile"("branchId","enabled");

CREATE TABLE "RepairCommunicationPreference" (
  "id" SERIAL PRIMARY KEY, "branchId" INTEGER NOT NULL, "repairJobId" INTEGER NOT NULL,
  "channelType" "CommunicationChannelType" NOT NULL, "contactChannelId" INTEGER, "profileId" INTEGER,
  "destinationSnapshot" TEXT, "displayLabelSnapshot" TEXT, "consentGranted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RepairCommunicationPreference_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RepairCommunicationPreference_repairJobId_fkey" FOREIGN KEY ("repairJobId") REFERENCES "RepairJob"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RepairCommunicationPreference_contactChannelId_fkey" FOREIGN KEY ("contactChannelId") REFERENCES "CustomerContactChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "RepairCommunicationPreference_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CommunicationProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RepairCommunicationPreference_repairJobId_key" ON "RepairCommunicationPreference"("repairJobId");
CREATE INDEX "RepairCommunicationPreference_branchId_channelType_idx" ON "RepairCommunicationPreference"("branchId","channelType");
CREATE INDEX "RepairCommunicationPreference_contactChannelId_idx" ON "RepairCommunicationPreference"("contactChannelId");
CREATE INDEX "RepairCommunicationPreference_profileId_idx" ON "RepairCommunicationPreference"("profileId");
