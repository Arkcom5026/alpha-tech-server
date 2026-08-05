'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repositoryPath = path.join(
  __dirname,
  '..',
  'src',
  'modules',
  'sales',
  'reservations',
  'lifecycle',
  'productReservationLifecyclePrismaRepository.js',
);
const source = fs.readFileSync(repositoryPath, 'utf8');

const required = [
  "command.commandType === 'ACCEPT'",
  'allocatePhysicalInventory({ tx, command })',
  'FOR UPDATE OF item',
  "stock.\"status\" = 'IN_STOCK'",
  'FOR UPDATE SKIP LOCKED',
  'reservation.\"status\" IN ${activeAllocationStatuses}',
  'lot.\"status\" = \'ACTIVE\'',
  'ORDER BY lot.\"receivedAt\", lot.\"id\"',
  'PRODUCT_RESERVATION_PHYSICAL_ALLOCATION_UNAVAILABLE',
  'updateAllocatedReservationItem',
  'insertAllocatedReservationItem',
  'stockItemId',
  'simpleLotId',
  '${lineType}::"ProductReservationLineType"',
];

for (const token of required) {
  assert(source.includes(token), `Missing accept-time physical allocation authority: ${token}`);
}

assert(
  source.indexOf("command.commandType === 'ACCEPT'") < source.indexOf('UPDATE "ProductReservation"'),
  'Physical allocation must complete before reservation status changes to ACCEPTED',
);

assert(
  !source.includes('SET "lineType" = ${lineType},'),
  'Physical allocation UPDATE must never send ProductReservationLineType as uncast text',
);

assert(
  !source.includes('${`${item.lineId}-A${allocationIndex}`}, ${lineType},'),
  'Physical allocation INSERT must never send ProductReservationLineType as uncast text',
);

assert(
  !source.includes('UPDATE "StockBalance"\n        SET "reserved" = "reserved" +'),
  'Accept-time allocation must not reserve quantity a second time',
);

console.log('ProductReservation accept-time physical allocation contract: PASS');
