'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const migration = read('prisma/migrations/20260728213000_partner_store_capability_foundation/migration.sql');

assert.match(migration, /CREATE TABLE "PartnerStoreCapability"/);
assert.match(migration, /"branchId" INTEGER NOT NULL UNIQUE/);
assert.match(migration, /"storefrontEnabled" BOOLEAN NOT NULL DEFAULT FALSE/);
assert.match(migration, /"pickupEnabled" BOOLEAN NOT NULL DEFAULT TRUE/);
assert.match(migration, /"deliveryEnabled" BOOLEAN NOT NULL DEFAULT FALSE/);
assert.match(migration, /"deliveryFeeMode" "OnlineDeliveryFeeMode"/);
assert.match(migration, /"serviceAreaMode" "StoreServiceAreaMode"/);
assert.match(migration, /PartnerStoreCapability_delivery_policy_consistent/);
assert.match(migration, /PartnerStoreCapability_fixed_fee_consistent/);
assert.match(migration, /PartnerStoreCapability_distance_consistent/);
assert.match(migration, /CREATE TABLE "PartnerStoreServiceArea"/);
assert.match(migration, /ON DELETE CASCADE/);
assert.match(migration, /UNIQUE \("capabilityId", "areaType", "areaCode"\)/);
assert.match(migration, /StoreServiceAreaType/);
assert.match(migration, /PROVINCE/);
assert.match(migration, /DISTRICT/);
assert.match(migration, /SUBDISTRICT/);
assert.match(migration, /POSTAL_CODE/);

// Mutable store policy must not mutate the ProductReservation snapshot table.
assert.doesNotMatch(migration, /ALTER TABLE "ProductReservation"/);

console.log('partner store capability foundation contract: PASS');
