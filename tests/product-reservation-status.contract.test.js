'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const routes = read('src/modules/sales/reservation/routes/productReservationRoutes.js');
const repository = read('src/modules/sales/reservation/status/productReservationReadyRepository.js');
const service = read('src/modules/sales/reservation/status/productReservationReadyService.js');

assert.match(routes, /router\.post\('\/:id\/ready-for-pickup', markProductReservationReadyController\)/);
assert.match(repository, /FOR UPDATE/);
assert.match(repository, /reservation\.status === 'READY_FOR_PICKUP'/);
assert.match(repository, /\['ACTIVE', 'PARTIALLY_PAID'\]/);
assert.match(repository, /"isActive" = TRUE/);
assert.match(repository, /SET "status" = 'READY_FOR_PICKUP'/);
assert.match(repository, /"pickupAt" = COALESCE\("pickupAt", CURRENT_TIMESTAMP\)/);
assert.match(service, /RESERVATION_INPUT_INVALID/);
assert.doesNotMatch(repository, /StockBalance/);
assert.doesNotMatch(repository, /StockMovement/);

console.log('Product reservation status contract: PASS');
