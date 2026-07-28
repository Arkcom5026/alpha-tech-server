'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const money = (value) => Number(value || 0);
const mapReservation = (row) => ({
  id: Number(row.id),
  code: row.code,
  branchId: Number(row.branchId),
  customerId: Number(row.customerId),
  createdByEmployeeId: Number(row.createdByEmployeeId),
  status: row.status,
  totalBeforeDiscount: money(row.totalBeforeDiscount),
  totalDiscount: money(row.totalDiscount),
  totalAmount: money(row.totalAmount),
  depositAmount: money(row.depositAmount),
  outstandingAmount: Math.max(0, money(row.totalAmount) - money(row.depositAmount)),
  note: row.note || null,
  pickupAt: row.pickupAt || null,
  expiresAt: row.expiresAt || null,
  convertedSaleId: row.convertedSaleId == null ? null : Number(row.convertedSaleId),
  completedAt: row.completedAt || null,
  cancelledAt: row.cancelledAt || null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  itemCount: row.itemCount == null ? undefined : Number(row.itemCount),
});

const list = async ({ branchId, status, customerId, keyword, limit, offset }, db = prisma) => {
  const rows = await db.$queryRaw(Prisma.sql`
    SELECT reservation.*, COUNT(item."id")::int AS "itemCount",
      COUNT(*) OVER()::int AS "totalCount"
    FROM "ProductReservation" reservation
    LEFT JOIN "ProductReservationItem" item ON item."reservationId" = reservation."id"
    WHERE reservation."branchId" = ${branchId}
      AND (${status || null}::text IS NULL OR reservation."status" = ${status || null})
      AND (${customerId || null}::int IS NULL OR reservation."customerId" = ${customerId || null})
      AND (${keyword || ''}::text = '' OR reservation."code" ILIKE '%' || ${keyword || ''} || '%')
    GROUP BY reservation."id"
    ORDER BY reservation."createdAt" DESC, reservation."id" DESC
    LIMIT ${limit} OFFSET ${offset}
  `);
  return {
    items: rows.map(mapReservation),
    total: rows.length ? Number(rows[0].totalCount || 0) : 0,
    limit,
    offset,
  };
};

const findById = async ({ id, branchId }, db = prisma) => {
  const reservations = await db.$queryRaw(Prisma.sql`
    SELECT reservation.*
    FROM "ProductReservation" reservation
    WHERE reservation."id" = ${id} AND reservation."branchId" = ${branchId}
    LIMIT 1
  `);
  const reservation = reservations[0];
  if (!reservation) return null;

  const items = await db.$queryRaw(Prisma.sql`
    SELECT item.*, product."name" AS "productName", product."mode"::text AS "productMode",
      product."saleBarcode", stock."barcode" AS "stockBarcode",
      stock."serialNumber" AS "stockSerialNumber", stock."status"::text AS "stockStatus"
    FROM "ProductReservationItem" item
    JOIN "Product" product ON product."id" = item."productId"
    LEFT JOIN "StockItem" stock ON stock."id" = item."stockItemId"
    WHERE item."reservationId" = ${id}
    ORDER BY item."id" ASC
  `);

  return {
    ...mapReservation(reservation),
    items: items.map((item) => ({
      id: Number(item.id),
      reservationId: Number(item.reservationId),
      lineId: item.lineId,
      lineType: item.lineType,
      productId: Number(item.productId),
      productName: item.productName,
      productMode: item.productMode,
      saleBarcode: item.saleBarcode || null,
      stockItemId: item.stockItemId == null ? null : Number(item.stockItemId),
      stockBarcode: item.stockBarcode || null,
      stockSerialNumber: item.stockSerialNumber || null,
      stockStatus: item.stockStatus || null,
      simpleLotId: item.simpleLotId == null ? null : Number(item.simpleLotId),
      quantity: money(item.quantity),
      basePrice: money(item.basePrice),
      discount: money(item.discount),
      price: money(item.price),
      vatAmount: money(item.vatAmount),
      remark: item.remark || null,
      isActive: Boolean(item.isActive),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  };
};

module.exports = Object.freeze({ list, findById });
