'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const migrationPath =
  'prisma/migrations/20260729143000_partner_store_capability_foundation/migration.sql';
const migration = read(migrationPath);
const schema = read('prisma/partner-store-capability.prisma');
const packageJson = JSON.parse(read('package.json'));
const server = read('server.js');
const routes = read('src/modules/partnerStore/routes/partnerStoreCapabilityRoutes.js');
const controller = read('src/modules/partnerStore/controllers/partnerStoreCapabilityController.js');
const service = read('src/modules/partnerStore/services/partnerStoreCapabilityService.js');
const repository = read('src/modules/partnerStore/repositories/partnerStoreCapabilityRepository.js');

// Migration authority.
assert.match(migration, /CREATE TYPE "OnlineDeliveryFeeMode" AS ENUM/);
assert.match(migration, /'FREE'/);
assert.match(migration, /'FIXED'/);
assert.match(migration, /'NEGOTIATED'/);
assert.match(migration, /CREATE TYPE "StoreServiceAreaMode" AS ENUM/);
assert.match(migration, /'PICKUP_ONLY'/);
assert.match(migration, /'ADMIN_AREAS'/);
assert.match(migration, /'DISTANCE'/);
assert.match(migration, /'NATIONWIDE'/);
assert.match(migration, /CREATE TYPE "StoreServiceAreaType" AS ENUM/);
assert.match(migration, /'PROVINCE'/);
assert.match(migration, /'DISTRICT'/);
assert.match(migration, /'SUBDISTRICT'/);
assert.match(migration, /'POSTAL_CODE'/);
assert.match(migration, /CREATE TABLE "PartnerStoreCapability"/);
assert.match(migration, /"branchId" INTEGER NOT NULL UNIQUE/);
assert.match(migration, /"storefrontEnabled" BOOLEAN NOT NULL DEFAULT FALSE/);
assert.match(migration, /"storefrontSlug" TEXT UNIQUE/);
assert.match(migration, /"pickupEnabled" BOOLEAN NOT NULL DEFAULT TRUE/);
assert.match(migration, /"deliveryEnabled" BOOLEAN NOT NULL DEFAULT FALSE/);
assert.match(migration, /"deliveryFeeMode" "OnlineDeliveryFeeMode"/);
assert.match(migration, /"fixedDeliveryFee" DECIMAL\(12,2\)/);
assert.match(migration, /"serviceAreaMode" "StoreServiceAreaMode" NOT NULL DEFAULT 'PICKUP_ONLY'/);
assert.match(migration, /"maxDeliveryDistanceKm" DECIMAL\(8,2\)/);
assert.match(migration, /PartnerStoreCapability_branchId_fkey/);
assert.match(migration, /REFERENCES "Branch"\("id"\) ON DELETE RESTRICT/);
assert.match(migration, /PartnerStoreCapability_delivery_policy_consistent/);
assert.match(migration, /PartnerStoreCapability_fixed_fee_consistent/);
assert.match(migration, /PartnerStoreCapability_distance_consistent/);
assert.match(migration, /CREATE TABLE "PartnerStoreServiceArea"/);
assert.match(migration, /"capabilityId" INTEGER NOT NULL/);
assert.match(migration, /ON DELETE CASCADE/);
assert.match(migration, /UNIQUE \("capabilityId", "areaType", "areaCode"\)/);
assert.match(migration, /PartnerStoreServiceArea_lookup_idx/);

// Prisma projection authority.
assert.equal(packageJson.prisma?.schema, 'prisma');
assert.match(schema, /model PartnerStoreCapability/);
assert.match(schema, /branchId\s+Int\s+@unique/);
assert.match(schema, /storefrontSlug\s+String\?\s+@unique/);
assert.match(schema, /serviceAreas\s+PartnerStoreServiceArea\[\]/);
assert.match(schema, /model PartnerStoreServiceArea/);
assert.match(schema, /capability\s+PartnerStoreCapability\s+@relation/);
assert.match(schema, /@@unique\(\[capabilityId, areaType, areaCode\]\)/);
assert.match(schema, /enum OnlineDeliveryFeeMode/);
assert.match(schema, /enum StoreServiceAreaMode/);
assert.match(schema, /enum StoreServiceAreaType/);

// Internal runtime authority and branch isolation.
assert.match(server, /require\('\.\/src\/modules\/partnerStore\/routes\/partnerStoreCapabilityRoutes'\)/);
assert.match(server, /app\.use\('\/api\/partner-store', partnerStoreCapabilityRoutes\)/);
assert.match(routes, /router\.get\('\/capability'/);
assert.match(routes, /router\.put\('\/capability'/);
assert.match(routes, /router\.use\(verifyToken, requireEmployeeContext\)/);
assert.match(controller, /req\.employee\?\.branchId \|\| req\.user\?\.branchId/);
assert.doesNotMatch(controller, /req\.body\?\.branchId/);
assert.doesNotMatch(controller, /req\.params\?\.branchId/);
assert.match(service, /storefrontEnabled/);
assert.match(service, /deliveryEnabled/);
assert.match(service, /serviceAreaMode/);
assert.match(service, /withTransaction/);
assert.match(repository, /client\.partnerStoreCapability\.findUnique/);
assert.match(repository, /client\.partnerStoreCapability\.upsert/);
assert.match(repository, /client\.partnerStoreServiceArea\.deleteMany/);
assert.match(repository, /client\.partnerStoreServiceArea\.createMany/);

// Mutable current store policy must remain independent from immutable reservation snapshots.
assert.doesNotMatch(migration, /ALTER TABLE "ProductReservation"/);
assert.doesNotMatch(migration, /CREATE TABLE "OrderOnline"/);
assert.doesNotMatch(migration, /ALTER TABLE "OrderOnline"/);

// Existing branches remain unpublished until explicitly configured.
assert.match(migration, /"storefrontEnabled" BOOLEAN NOT NULL DEFAULT FALSE/);

console.log('partner store capability repository contract: PASS');
