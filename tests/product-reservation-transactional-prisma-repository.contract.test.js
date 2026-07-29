'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const repository = fs.readFileSync(
  path.join(root, 'src/modules/sales/reservations/lifecycle/productReservationLifecyclePrismaRepository.js'),
  'utf8',
);

for (const token of [
  'findCommandReplay',
  'findForLifecycleCommand',
  'executeLifecycleTransition',
  'db.$transaction(async (tx)',
  'FOR UPDATE',
  'command."branchId" = ${branchId}',
  'reservation."branchId" = ${branchId}',
  'Number(locked.version) !== Number(current.version)',
  '"version" = "version" + 1',
  '"reserved" = "reserved" - ${quantity}',
  'AND "reserved" >= ${quantity}',
  "'RELEASE'::\"StockMovementType\"",
  "'PRODUCT_RESERVATION'",
  'ProductReservationLifecycleCommand',
  'ProductReservationLifecycleEvent',
  'GROUP BY "productId"',
  'stockReleasedAt',
]) {
  assert.ok(repository.includes(token), `Missing transactional lifecycle repository authority: ${token}`);
}

assert.match(repository, /WHERE "id" = \$\{command\.reservationId\}[\s\S]*AND "branchId" = \$\{command\.branchId\}[\s\S]*FOR UPDATE/);
assert.match(repository, /UPDATE "StockBalance"[\s\S]*AND "branchId" = \$\{command\.branchId\}[\s\S]*AND "reserved" >= \$\{quantity\}/);
assert.match(repository, /INSERT INTO "StockMovement"[\s\S]*'RELEASE'::"StockMovementType"[\s\S]*'PRODUCT_RESERVATION'/);
assert.match(repository, /INSERT INTO "ProductReservationLifecycleCommand"[\s\S]*INSERT INTO "ProductReservationLifecycleEvent"/);
assert.doesNotMatch(repository, /INSERT INTO "(?:Sale|Payment|Delivery|OrderOnline)"/);

console.log('ProductReservation transactional Prisma repository contract: PASS');
