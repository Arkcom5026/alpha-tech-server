-- Partner Store Capability Foundation — current-main reconstruction
-- Additive and non-destructive. Existing branches remain unpublished by default.

CREATE TYPE "OnlineDeliveryFeeMode" AS ENUM (
  'FREE',
  'FIXED',
  'NEGOTIATED'
);

CREATE TYPE "StoreServiceAreaMode" AS ENUM (
  'PICKUP_ONLY',
  'ADMIN_AREAS',
  'DISTANCE',
  'NATIONWIDE'
);

CREATE TYPE "StoreServiceAreaType" AS ENUM (
  'PROVINCE',
  'DISTRICT',
  'SUBDISTRICT',
  'POSTAL_CODE'
);

CREATE TABLE "PartnerStoreCapability" (
  "id" SERIAL PRIMARY KEY,
  "branchId" INTEGER NOT NULL UNIQUE,
  "storefrontEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "storefrontSlug" TEXT UNIQUE,
  "displayName" TEXT,
  "contactPhone" TEXT,
  "pickupEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "deliveryEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "deliveryFeeMode" "OnlineDeliveryFeeMode",
  "fixedDeliveryFee" DECIMAL(12,2),
  "serviceAreaMode" "StoreServiceAreaMode" NOT NULL DEFAULT 'PICKUP_ONLY',
  "maxDeliveryDistanceKm" DECIMAL(8,2),
  "preparationSlaMinutes" INTEGER,
  "pickupInstruction" TEXT,
  "deliveryInstruction" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerStoreCapability_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PartnerStoreCapability_fixedDeliveryFee_nonnegative"
    CHECK ("fixedDeliveryFee" IS NULL OR "fixedDeliveryFee" >= 0),
  CONSTRAINT "PartnerStoreCapability_maxDistance_positive"
    CHECK ("maxDeliveryDistanceKm" IS NULL OR "maxDeliveryDistanceKm" > 0),
  CONSTRAINT "PartnerStoreCapability_sla_positive"
    CHECK ("preparationSlaMinutes" IS NULL OR "preparationSlaMinutes" > 0),
  CONSTRAINT "PartnerStoreCapability_delivery_policy_consistent"
    CHECK (
      ("deliveryEnabled" = FALSE AND "deliveryFeeMode" IS NULL AND "fixedDeliveryFee" IS NULL AND "serviceAreaMode" = 'PICKUP_ONLY' AND "maxDeliveryDistanceKm" IS NULL)
      OR
      ("deliveryEnabled" = TRUE AND "deliveryFeeMode" IS NOT NULL AND "serviceAreaMode" <> 'PICKUP_ONLY')
    ),
  CONSTRAINT "PartnerStoreCapability_fixed_fee_consistent"
    CHECK (
      ("deliveryFeeMode" = 'FIXED' AND "fixedDeliveryFee" IS NOT NULL AND "fixedDeliveryFee" > 0)
      OR
      ("deliveryFeeMode" IS DISTINCT FROM 'FIXED' AND "fixedDeliveryFee" IS NULL)
    ),
  CONSTRAINT "PartnerStoreCapability_distance_consistent"
    CHECK (
      ("serviceAreaMode" = 'DISTANCE' AND "maxDeliveryDistanceKm" IS NOT NULL)
      OR
      ("serviceAreaMode" <> 'DISTANCE' AND "maxDeliveryDistanceKm" IS NULL)
    )
);

CREATE TABLE "PartnerStoreServiceArea" (
  "id" SERIAL PRIMARY KEY,
  "capabilityId" INTEGER NOT NULL,
  "areaType" "StoreServiceAreaType" NOT NULL,
  "areaCode" TEXT NOT NULL,
  "areaName" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerStoreServiceArea_capabilityId_fkey"
    FOREIGN KEY ("capabilityId") REFERENCES "PartnerStoreCapability"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PartnerStoreServiceArea_capability_area_unique"
    UNIQUE ("capabilityId", "areaType", "areaCode")
);

CREATE INDEX "PartnerStoreCapability_storefrontEnabled_idx"
  ON "PartnerStoreCapability"("storefrontEnabled");

CREATE INDEX "PartnerStoreCapability_pickup_delivery_idx"
  ON "PartnerStoreCapability"("pickupEnabled", "deliveryEnabled");

CREATE INDEX "PartnerStoreServiceArea_lookup_idx"
  ON "PartnerStoreServiceArea"("areaType", "areaCode", "active");
