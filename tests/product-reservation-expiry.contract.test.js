'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const repository = read('src/modules/sales/reservation/expiry/productReservationExpiryRepository.js');
const service = read('src/modules/sales/reservation/expiry/productReservationExpiryService.js');
const sharedRelease = read('src/modules/sales/reservation/shared/productReservationAllocationRelease.js');
const cancelRepository = read('src/modules/sales/reservation/cancel/productReservationCancelRepository.js');
const routes = read('src/modules/sales/reservation/routes/productReservationRoutes.js');

assert.match(repository, /status" IN \('ACTIVE', 'PARTIALLY_PAID', 'READY_FOR_PICKUP'\)/);
assert.match(repository, /"expiresAt" IS NOT NULL/);
assert.match(repository, /"expiresAt" <=/);
assert.match(repository, /FOR UPDATE SKIP LOCKED/);
assert.match(repository, /releaseReservationAllocation/);
assert.match(repository, /"status" = 'EXPIRED'/);
assert.match(repository, /PRODUCT_RESERVATION_EXPIRE/);
assert.match(service, /Math\.min\(requestedLimit, 100\)/);
assert.match(sharedRelease, /"reserved" = "reserved" -/);
assert.match(sharedRelease, /"reserved" >=/);
assert.match(sharedRelease, /"isActive" = FALSE/);
assert.match(cancelRepository, /releaseReservationAllocation/);
assert.match(routes, /router\.post\('\/expire-due', expireDueProductReservationsController\)/);

console.log('product reservation expiry contract: PASS');
