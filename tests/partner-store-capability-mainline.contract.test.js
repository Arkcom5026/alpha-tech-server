'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const migration = fs.readFileSync(
  path.join(root, 'prisma/migrations/20260729003000_partner_store_capability_mainline/migration.sql'),
  'utf8'
);
const aligner = fs.readFileSync(
  path.join(root, 'scripts/align-partner-store-capability-prisma.js'),
  'utf8'
);
const increment = fs.readFileSync(
  path.join(root, 'docs/increments/partner-store-capability-mainline-reconstruction.md'),
  'utf8'
);

assert.match(migration, /CREATE TABLE IF NOT EXISTS "PartnerStoreCapability"/);
assert.match(migration, /"branchId" INTEGER NOT NULL UNIQUE/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS "PartnerStoreServiceArea"/);
assert.match(migration, /ON DELETE CASCADE/);
assert.match(migration, /storefrontEnabled" BOOLEAN NOT NULL DEFAULT FALSE/);
assert.match(migration, /pickupEnabled" BOOLEAN NOT NULL DEFAULT TRUE/);
assert.match(migration, /deliveryEnabled" BOOLEAN NOT NULL DEFAULT FALSE/);
assert.match(migration, /PartnerStoreCapability_delivery_policy_consistent/);
assert.match(migration, /CREATE INDEX IF NOT EXISTS "PartnerStoreCapability_storefrontEnabled_idx"/);

assert.match(aligner, /model PartnerStoreCapability/);
assert.match(aligner, /model PartnerStoreServiceArea/);
assert.match(aligner, /partnerStoreCapability\s+PartnerStoreCapability\?/);
assert.match(aligner, /enum OnlineDeliveryFeeMode/);
assert.match(aligner, /enum StoreServiceAreaMode/);
assert.match(aligner, /enum StoreServiceAreaType/);
assert.match(aligner, /--check/);

assert.match(increment, /without merging or rebasing/);
assert.match(increment, /selective and additive/i);
assert.match(increment, /no production migration or deployment/i);

console.log('Partner Store Capability mainline contract: PASS');
