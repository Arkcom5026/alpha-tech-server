'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const conflict = (code, message, details) => {
  throw Object.assign(new Error(message), { statusCode: 409, code, details });
};

const cancel = async ({ id, branchId, employeeId, reason }, db = prisma) => db.$transaction(async (tx) => {
  const reservations = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "ProductReservation"
    WHERE "id" = ${id} AND "branchId" = ${branchId}
    FOR UPDATE
  `);
  const reservation = reservations[0];
  if (!reservation) {
    throw Object.assign(new Error('Product reservation was not found'), {
      statusCode: 404,
      code: 'RESERVATION_NOT_FOUND',
    });
  }

  if (reservation.status === 'CANCELLED') {
    return { id: Number(reservation.id), code: reservation.code, status: reservation.status, replayed: true };
  }
  if (!['ACTIVE', 'PARTIALLY_PAID', 'READY_FOR_PICKUP'].includes(reservation.status)) {
    conflict('RESERVATION_NOT_CANCELLABLE', 'Reservation cannot be cancelled from its current status', {
      status: reservation.status,
    });
  }

  const items = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "ProductReservationItem"
    WHERE "reservationId" = ${id} AND "isActive" = TRUE
    ORDER BY "id" ASC
    FOR UPDATE
  `);

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
    WHERE "reservationId" = ${id} AND "isActive" = TRUE
  `);

  const updated = await tx.$queryRaw(Prisma.sql`
    UPDATE "ProductReservation"
    SET "status" = 'CANCELLED', "cancelledAt" = CURRENT_TIMESTAMP,
      "note" = CASE
        WHEN ${reason || null}::text IS NULL THEN "note"
        WHEN "note" IS NULL OR "note" = '' THEN ${reason || null}
        ELSE "note" || E'\nCancellation: ' || ${reason || null}
      END,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
    RETURNING *
  `);

  for (const item of items) {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "StockMovement" (
        "productId", "branchId", "qty", "type", "refType", "refId", "note",
        "simpleLotId", "stockItemId", "performedByEmployeeId", "occurredAt", "createdAt"
      ) VALUES (
        ${Number(item.productId)}, ${branchId}, ${Number(item.quantity)}, 'RESERVE',
        'PRODUCT_RESERVATION_CANCEL', ${id}, ${`Release reservation ${reservation.code}`},
        ${item.simpleLotId == null ? null : Number(item.simpleLotId)},
        ${item.stockItemId == null ? null : Number(item.stockItemId)},
        ${employeeId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `);
  }

  return {
    id: Number(updated[0].id),
    code: updated[0].code,
    status: updated[0].status,
    cancelledAt: updated[0].cancelledAt,
    releasedItemCount: items.length,
    replayed: false,
  };
});

module.exports = Object.freeze({ cancel });
