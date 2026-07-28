'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const migration = read('prisma/migrations/20260728203000_online_fulfillment_lifecycle/migration.sql');
const pickupRepository = read('src/modules/sales/reservation/status/productReservationReadyRepository.js');
const deliveryRepository = read('src/modules/sales/reservation/status/productReservationDeliveryStatusRepository.js');
const deliveryService = read('src/modules/sales/reservation/status/productReservationDeliveryStatusService.js');
const routes = read('src/modules/sales/reservation/routes/productReservationRoutes.js');
const queryService = read('src/modules/sales/reservation/query/productReservationQueryService.js');

assert.match(migration, /READY_TO_SHIP/);
assert.match(migration, /SHIPPING/);
assert.match(migration, /DELIVERED/);

assert.match(pickupRepository, /fulfillmentMethod !== 'PICKUP'/);
assert.match(pickupRepository, /RESERVATION_PICKUP_METHOD_REQUIRED/);

assert.match(deliveryRepository, /fulfillmentMethod !== 'DELIVERY'/);
assert.match(deliveryRepository, /READY_TO_SHIP: \['ACTIVE', 'PARTIALLY_PAID'\]/);
assert.match(deliveryRepository, /SHIPPING: \['READY_TO_SHIP'\]/);
assert.match(deliveryRepository, /DELIVERED: \['SHIPPING'\]/);
assert.match(deliveryRepository, /FOR UPDATE/);
assert.match(deliveryRepository, /RESERVATION_DELIVERY_TRANSITION_INVALID/);

assert.match(deliveryService, /READY_TO_SHIP/);
assert.match(deliveryService, /SHIPPING/);
assert.match(deliveryService, /DELIVERED/);

assert.match(routes, /\/:id\/ready-to-ship/);
assert.match(routes, /\/:id\/shipping/);
assert.match(routes, /\/:id\/delivered/);

assert.match(queryService, /'READY_TO_SHIP'/);
assert.match(queryService, /'SHIPPING'/);
assert.match(queryService, /'DELIVERED'/);

console.log('online fulfillment lifecycle contract: PASS');
