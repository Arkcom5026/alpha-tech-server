'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const conflict = (code, message, details) => {
  throw Object.assign(new Error(message), { statusCode: 409, code, details });
};

const TRANSITIONS = Object.freeze({
  READY_TO_SHIP: ['ACTIVE', 'PARTIALLY_PAID'],
  SHIPPING: ['READY_TO_SHIP'],
  DELIVERED: ['SHIPPING'],
});

const transitionDeliveryStatus = async ({ id, branchId, targetStatus }, db = prisma) => db.$transaction(async (tx) => {
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

  if (reservation.fulfillmentMethod !== 'DELIVERY') {
    conflict('RESERVATION_DELIVERY_METHOD_REQUIRED', 'Only delivery reservations can use delivery lifecycle transitions', {
      fulfillmentMethod: reservation.fulfillmentMethod,
    });
  }

  if (reservation.status === targetStatus) {
    return {
      id: Number(reservation.id),
      code: reservation.code,
      status: reservation.status,
      fulfillmentMethod: reservation.fulfillmentMethod,
      replayed: true,
    };
  }

  const allowedFrom = TRANSITIONS[targetStatus] || [];
  if (!allowedFrom.includes(reservation.status)) {
    conflict('RESERVATION_DELIVERY_TRANSITION_INVALID', 'Reservation cannot move to the requested delivery status', {
      currentStatus: reservation.status,
      targetStatus,
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
    SET "status" = ${targetStatus}::"ProductReservationStatus",
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
    RETURNING *
  `);

  return {
    id: Number(updated[0].id),
    code: updated[0].code,
    status: updated[0].status,
    fulfillmentMethod: updated[0].fulfillmentMethod,
    replayed: false,
  };
});

module.exports = Object.freeze({ TRANSITIONS, transitionDeliveryStatus });
