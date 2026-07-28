'use strict';

const { Prisma } = require('../../../../../lib/prisma');

const conflict = (code, message, details) => {
  throw Object.assign(new Error(message), { statusCode: 409, code, details });
};

const releaseReservationAllocation = async ({
  tx,
  reservation,
  items,
  branchId,
  employeeId,
  movementRefType,
  movementNote,
}) => {
  const simpleByProduct = new Map();
  for (const item of items) {
    if (item.lineType === 'SIMPLE') {
      const productId = Number(item.productId);
      simpleByProduct.set(productId, (simpleByProduct.get(productId) || 0) + Number(item.quantity));
    }
  }

  for (const [productId, quantity] of simpleByProduct.entries()) {
    const changed = await tx.$executeRaw(Prisma.sql`
      UPDATE "StockBalance"
      SET "reserved" = "reserved" - ${quantity}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "productId" = ${productId}
        AND "branchId" = ${branchId}
        AND "reserved" >= ${quantity}
    `);
    if (changed !== 1) {
      conflict('RESERVATION_RELEASE_CONFLICT', 'Reserved stock could not be released safely', {
        productId,
        quantity,
      });
    }
  }

  await tx.$executeRaw(Prisma.sql`
    UPDATE "ProductReservationItem"
    SET "isActive" = FALSE, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "reservationId" = ${Number(reservation.id)} AND "isActive" = TRUE
  `);

  for (const item of items) {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "StockMovement" (
        "productId", "branchId", "qty", "type", "refType", "refId", "note",
        "simpleLotId", "stockItemId", "performedByEmployeeId", "occurredAt", "createdAt"
      ) VALUES (
        ${Number(item.productId)}, ${branchId}, ${Number(item.quantity)}, 'RESERVE',
        ${movementRefType}, ${Number(reservation.id)}, ${movementNote},
        ${item.simpleLotId == null ? null : Number(item.simpleLotId)},
        ${item.stockItemId == null ? null : Number(item.stockItemId)},
        ${employeeId || null}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `);
  }

  return { releasedItemCount: items.length };
};

module.exports = Object.freeze({ releaseReservationAllocation });
