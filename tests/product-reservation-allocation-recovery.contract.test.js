'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const routes = read('src/modules/sales/reservations/merchant/productReservationMerchantRoutes.js');
const recovery = read('src/modules/sales/reservations/merchant/productReservationPhysicalAllocationRepository.js');

for (const token of [
  "router.post('/:reservationId/allocation'",
  'ensureMerchantReservationPhysicalAllocation',
  'branchId: req.user.branchId',
  'actorId: req.user.employeeId',
]) assert(routes.includes(token), `Missing allocation recovery route authority: ${token}`);

for (const token of [
  "new Set(['ACCEPTED', 'FULFILLMENT_READY', 'READY_FOR_PICKUP'])",
  'FOR UPDATE',
  'allocatePhysicalInventory',
  'PRODUCT_RESERVATION_ALLOCATION_STATUS_INVALID',
  'PRODUCT_RESERVATION_PHYSICAL_ALLOCATION_INCOMPLETE',
  'stockItemId == null && item.simpleLotId == null',
]) assert(recovery.includes(token), `Missing allocation recovery contract: ${token}`);

assert(
  !recovery.includes('SET "reserved" = "reserved" +'),
  'Allocation recovery must never reserve quantity twice',
);

console.log('ProductReservation allocation recovery contract: PASS');
