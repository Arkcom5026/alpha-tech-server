'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const migration = read('prisma/migrations/20260728190000_online_commerce_foundation_alignment/migration.sql');
const createService = read('src/modules/sales/reservation/create/productReservationCreateService.js');
const createRepository = read('src/modules/sales/reservation/create/productReservationCreateRepository.js');
const queryService = read('src/modules/sales/reservation/query/productReservationQueryService.js');
const queryRepository = read('src/modules/sales/reservation/query/productReservationQueryRepository.js');
const increment = read('docs/increments/online-commerce-foundation-alignment-increment-2.md');

assert.match(migration, /CREATE TYPE "OnlineOrderSource"/);
assert.match(migration, /'MARKETPLACE'/);
assert.match(migration, /'STOREFRONT'/);
assert.match(migration, /CREATE TYPE "OnlineFulfillmentMethod"/);
assert.match(migration, /'PICKUP'/);
assert.match(migration, /'DELIVERY'/);
assert.match(migration, /CREATE TYPE "OnlineDeliveryFeeMode"/);
assert.match(migration, /'FREE'/);
assert.match(migration, /'FIXED'/);
assert.match(migration, /'NEGOTIATED'/);
assert.match(migration, /ADD COLUMN "deliveryAddress" TEXT/);

assert.match(createService, /ORDER_SOURCES/);
assert.match(createService, /FULFILLMENT_METHODS/);
assert.match(createService, /DELIVERY_FEE_MODES/);
assert.match(createService, /recipientName: requiredText/);
assert.match(createService, /recipientPhone: requiredText/);
assert.match(createService, /deliveryAddress: requiredText/);
assert.match(createService, /deliveryFee must be zero when deliveryFeeMode is FREE/);
assert.match(createService, /deliveryFee must be greater than zero when deliveryFeeMode is FIXED/);
assert.match(createService, /pickupAt is not allowed for DELIVERY fulfillment/);
assert.match(createService, /orderSource.*STOREFRONT/s);
assert.match(createService, /fulfillmentMethod.*PICKUP/s);

assert.match(createRepository, /RESERVATION_BRANCH_NOT_FOUND/);
assert.match(createRepository, /"orderSource"/);
assert.match(createRepository, /"fulfillmentMethod"/);
assert.match(createRepository, /"deliveryFeeMode"/);
assert.match(createRepository, /"deliveryAddress"/);
assert.match(createRepository, /orderGrandTotal/);
assert.match(createRepository, /FOR UPDATE/);
assert.match(createRepository, /'RESERVE'::"StockMovementType"/);

assert.match(queryService, /RESERVATION_ORDER_SOURCE_INVALID/);
assert.match(queryService, /RESERVATION_FULFILLMENT_METHOD_INVALID/);
assert.match(queryRepository, /reservation\."orderSource"::text/);
assert.match(queryRepository, /reservation\."fulfillmentMethod"::text/);
assert.match(queryRepository, /recipientPhone/);
assert.match(queryRepository, /sourceReference/);
assert.match(queryRepository, /orderGrandTotal/);
assert.match(queryRepository, /outstandingAmount/);

assert.match(increment, /Single Order Authority/);
assert.match(increment, /POS Hold Cart/);
assert.doesNotMatch(createRepository, /OrderOnline/);
assert.doesNotMatch(queryRepository, /OrderOnline/);

console.log('online commerce foundation contract: PASS');
