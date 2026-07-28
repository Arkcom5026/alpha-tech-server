'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');
const { releaseReservationAllocation } = require('../shared/productReservationAllocationRelease');

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

  const release = await releaseReservationAllocation({
    tx,
    reservation,
    items,
    branchId,
    employeeId,
    movementRefType: 'PRODUCT_RESERVATION_CANCEL',
    movementNote: `Release reservation ${reservation.code}`,
  });

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

  return {
    id: Number(updated[0].id),
    code: updated[0].code,
    status: updated[0].status,
    cancelledAt: updated[0].cancelledAt,
    releasedItemCount: release.releasedItemCount,
    replayed: false,
  };
});

module.exports = Object.freeze({ cancel });
