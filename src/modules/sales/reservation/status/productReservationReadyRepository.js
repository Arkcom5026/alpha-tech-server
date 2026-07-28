'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const conflict = (code, message, details) => {
  throw Object.assign(new Error(message), { statusCode: 409, code, details });
};

const markReady = async ({ id, branchId }, db = prisma) => db.$transaction(async (tx) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "ProductReservation"
    WHERE "id" = ${id} AND "branchId" = ${branchId}
    FOR UPDATE
  `);
  const reservation = rows[0];
  if (!reservation) {
    throw Object.assign(new Error('Product reservation was not found'), {
      statusCode: 404,
      code: 'RESERVATION_NOT_FOUND',
    });
  }
  if (reservation.status === 'READY_FOR_PICKUP') {
    return {
      id: Number(reservation.id),
      code: reservation.code,
      status: reservation.status,
      pickupAt: reservation.pickupAt,
      replayed: true,
    };
  }
  if (!['ACTIVE', 'PARTIALLY_PAID'].includes(reservation.status)) {
    conflict('RESERVATION_NOT_READY_TRANSITIONABLE', 'Reservation cannot be marked ready from its current status', {
      status: reservation.status,
    });
  }

  const activeItems = await tx.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int AS count
    FROM "ProductReservationItem"
    WHERE "reservationId" = ${id} AND "isActive" = TRUE
  `);
  if (Number(activeItems[0]?.count || 0) === 0) {
    conflict('RESERVATION_ITEMS_MISSING', 'Reservation has no active items');
  }

  const updated = await tx.$queryRaw(Prisma.sql`
    UPDATE "ProductReservation"
    SET "status" = 'READY_FOR_PICKUP',
        "pickupAt" = COALESCE("pickupAt", CURRENT_TIMESTAMP),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
    RETURNING *
  `);

  return {
    id: Number(updated[0].id),
    code: updated[0].code,
    status: updated[0].status,
    pickupAt: updated[0].pickupAt,
    replayed: false,
  };
});

module.exports = Object.freeze({ markReady });
