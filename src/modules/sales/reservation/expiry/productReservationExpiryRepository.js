'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');
const { releaseReservationAllocation } = require('../shared/productReservationAllocationRelease');

const expireDue = async ({ branchId, employeeId, limit, now }, db = prisma) => db.$transaction(async (tx) => {
  const dueReservations = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "ProductReservation"
    WHERE "branchId" = ${branchId}
      AND "status" IN ('ACTIVE', 'PARTIALLY_PAID', 'READY_FOR_PICKUP')
      AND "expiresAt" IS NOT NULL
      AND "expiresAt" <= ${now}
    ORDER BY "expiresAt" ASC, "id" ASC
    LIMIT ${limit}
    FOR UPDATE SKIP LOCKED
  `);

  const expired = [];
  for (const reservation of dueReservations) {
    const reservationId = Number(reservation.id);
    const items = await tx.$queryRaw(Prisma.sql`
      SELECT * FROM "ProductReservationItem"
      WHERE "reservationId" = ${reservationId} AND "isActive" = TRUE
      ORDER BY "id" ASC
      FOR UPDATE
    `);

    const release = await releaseReservationAllocation({
      tx,
      reservation,
      items,
      branchId,
      employeeId,
      movementRefType: 'PRODUCT_RESERVATION_EXPIRE',
      movementNote: `Expire reservation ${reservation.code}`,
    });

    const updated = await tx.$queryRaw(Prisma.sql`
      UPDATE "ProductReservation"
      SET "status" = 'EXPIRED', "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${reservationId}
        AND "status" IN ('ACTIVE', 'PARTIALLY_PAID', 'READY_FOR_PICKUP')
      RETURNING "id", "code", "status", "expiresAt", "updatedAt"
    `);

    if (updated[0]) {
      expired.push({
        id: Number(updated[0].id),
        code: updated[0].code,
        status: updated[0].status,
        expiresAt: updated[0].expiresAt,
        expiredAt: updated[0].updatedAt,
        releasedItemCount: release.releasedItemCount,
      });
    }
  }

  return { expired, expiredCount: expired.length, checkedAt: now };
});

module.exports = Object.freeze({ expireDue });
