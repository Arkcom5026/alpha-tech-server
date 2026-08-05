'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');
const {
  allocatePhysicalInventory,
} = require('../lifecycle/productReservationLifecyclePrismaRepository');

const conflict = (code, message, details = null, statusCode = 409) => {
  throw Object.assign(new Error(message), { code, statusCode, details });
};

const allowedStatuses = new Set(['ACCEPTED', 'FULFILLMENT_READY', 'READY_FOR_PICKUP']);

const ensureMerchantReservationPhysicalAllocation = async ({
  reservationId,
  branchId,
  actorId,
}, db = prisma) => db.$transaction(async (tx) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT "id", "code", "branchId", "status", "version"
    FROM "ProductReservation"
    WHERE "id" = ${reservationId}
      AND "branchId" = ${branchId}
    FOR UPDATE
  `);
  const reservation = rows[0];
  if (!reservation) {
    conflict('PRODUCT_RESERVATION_NOT_FOUND', 'ProductReservation was not found in the authorized branch', {
      reservationId,
      branchId,
    }, 404);
  }
  if (!allowedStatuses.has(reservation.status)) {
    conflict('PRODUCT_RESERVATION_ALLOCATION_STATUS_INVALID', 'Physical allocation recovery is only available after merchant acceptance', {
      reservationId,
      status: reservation.status,
      allowedStatuses: [...allowedStatuses],
    });
  }

  await allocatePhysicalInventory({
    tx,
    command: {
      reservationId,
      branchId,
      actorId,
      occurredAt: new Date(),
    },
  });

  const allocationRows = await tx.$queryRaw(Prisma.sql`
    SELECT "id", "lineId", "lineType", "productId", "stockItemId", "simpleLotId", "quantity"
    FROM "ProductReservationItem"
    WHERE "reservationId" = ${reservationId}
      AND "isActive" = TRUE
    ORDER BY "id"
  `);

  const incomplete = allocationRows.filter((item) => item.stockItemId == null && item.simpleLotId == null);
  if (incomplete.length) {
    conflict('PRODUCT_RESERVATION_PHYSICAL_ALLOCATION_INCOMPLETE', 'ProductReservation physical allocation is incomplete', {
      reservationId,
      itemIds: incomplete.map((item) => Number(item.id)),
    });
  }

  return Object.freeze({
    reservationId,
    reservationCode: reservation.code,
    status: reservation.status,
    version: Number(reservation.version),
    allocated: true,
    items: allocationRows.map((item) => Object.freeze({
      id: Number(item.id),
      lineId: item.lineId,
      lineType: item.lineType,
      productId: Number(item.productId),
      stockItemId: item.stockItemId == null ? null : Number(item.stockItemId),
      simpleLotId: item.simpleLotId == null ? null : Number(item.simpleLotId),
      quantity: Number(item.quantity),
    })),
  });
});

module.exports = Object.freeze({
  ensureMerchantReservationPhysicalAllocation,
});
