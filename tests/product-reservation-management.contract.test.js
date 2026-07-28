'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const routes = read('src/modules/sales/reservation/routes/productReservationRoutes.js');
const queryRepository = read('src/modules/sales/reservation/query/productReservationQueryRepository.js');
const queryService = read('src/modules/sales/reservation/query/productReservationQueryService.js');
const cancelRepository = read('src/modules/sales/reservation/cancel/productReservationCancelRepository.js');
const cancelService = read('src/modules/sales/reservation/cancel/productReservationCancelService.js');

assert.match(routes, /router\.get\('\/', listProductReservationsController\)/);
assert.match(routes, /router\.get\('\/:id', getProductReservationByIdController\)/);
assert.match(routes, /router\.post\('\/:id\/cancel', cancelProductReservationController\)/);

assert.match(queryRepository, /FROM "ProductReservation" reservation/);
assert.match(queryRepository, /reservation\."branchId" = \$\{branchId\}/);
assert.match(queryRepository, /COUNT\(\*\) OVER\(\)/);
assert.match(queryRepository, /FROM "ProductReservationItem" item/);
assert.match(queryService, /RESERVATION_STATUS_INVALID/);
assert.match(queryService, /RESERVATION_NOT_FOUND/);

assert.match(cancelRepository, /FROM "ProductReservation"/);
assert.match(cancelRepository, /FOR UPDATE/);
assert.match(cancelRepository, /"isActive" = TRUE/);
assert.match(cancelRepository, /"reserved" = "reserved" - \$\{quantity\}/);
assert.match(cancelRepository, /"reserved" >= \$\{quantity\}/);
assert.match(cancelRepository, /SET "isActive" = FALSE/);
assert.match(cancelRepository, /SET "status" = 'CANCELLED'/);
assert.match(cancelRepository, /PRODUCT_RESERVATION_CANCEL/);
assert.match(cancelRepository, /reservation\.status === 'CANCELLED'/);
assert.match(cancelRepository, /replayed: true/);
assert.match(cancelService, /reason.*slice\(0, 500\)/s);

console.log('product reservation management contract: PASS');
