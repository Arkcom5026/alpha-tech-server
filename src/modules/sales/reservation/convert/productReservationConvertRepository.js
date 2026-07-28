'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const loadForConversion = async ({ id, branchId }, db = prisma) => {
  const reservations = await db.$queryRaw(Prisma.sql`
    SELECT * FROM "ProductReservation"
    WHERE "id" = ${id} AND "branchId" = ${branchId}
    LIMIT 1
  `);
  const reservation = reservations[0];
  if (!reservation) return null;

  const items = await db.$queryRaw(Prisma.sql`
    SELECT * FROM "ProductReservationItem"
    WHERE "reservationId" = ${id} AND "isActive" = TRUE
    ORDER BY "id" ASC
  `);

  return {
    id: Number(reservation.id),
    code: reservation.code,
    branchId: Number(reservation.branchId),
    customerId: Number(reservation.customerId),
    status: reservation.status,
    totalBeforeDiscount: Number(reservation.totalBeforeDiscount || 0),
    totalDiscount: Number(reservation.totalDiscount || 0),
    totalAmount: Number(reservation.totalAmount || 0),
    depositAmount: Number(reservation.depositAmount || 0),
    note: reservation.note || null,
    convertedSaleId: reservation.convertedSaleId == null ? null : Number(reservation.convertedSaleId),
    items: items.map((item) => ({
      lineId: item.lineId,
      lineType: item.lineType,
      productId: Number(item.productId),
      stockItemId: item.stockItemId == null ? null : Number(item.stockItemId),
      simpleLotId: item.simpleLotId == null ? null : Number(item.simpleLotId),
      quantity: Number(item.quantity),
      basePrice: Number(item.basePrice),
      discount: Number(item.discount),
      price: Number(item.price),
      vatAmount: Number(item.vatAmount),
      remark: item.remark || null,
    })),
  };
};

module.exports = Object.freeze({ loadForConversion });
