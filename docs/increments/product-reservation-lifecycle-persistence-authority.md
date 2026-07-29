'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const normalizeLimit = (value, fallback = 50, maximum = 100) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
};

const listMerchantReservations = async ({ branchId, statuses, limit }, db = prisma) => {
  const normalizedLimit = normalizeLimit(limit);
  const statusFilter = Array.isArray(statuses) && statuses.length
    ? Prisma.sql`AND reservation."status" IN (${Prisma.join(statuses)})`
    : Prisma.empty;

  const rows = await db.$queryRaw(Prisma.sql`
    SELECT reservation."id", reservation."code", reservation."status",
           reservation."orderSource", reservation."fulfillmentMethod",
           reservation."totalAmount", reservation."depositAmount",
           reservation."expiresAt", reservation."stockReleasedAt",
           reservation."version", reservation."createdAt", reservation."updatedAt",
           COUNT(item."id")::INTEGER AS "itemCount",
           COALESCE(SUM(item."quantity"), 0) AS "totalQuantity"
    FROM "ProductReservation" reservation
    LEFT JOIN "ProductReservationItem" item
      ON item."reservationId" = reservation."id"
     AND item."isActive" = TRUE
    WHERE reservation."branchId" = ${branchId}
      ${statusFilter}
    GROUP BY reservation."id"
    ORDER BY reservation."createdAt" DESC, reservation."id" DESC
    LIMIT ${normalizedLimit}
  `);

  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    version: Number(row.version),
    itemCount: Number(row.itemCount),
    totalQuantity: Number(row.totalQuantity),
    totalAmount: Number(row.totalAmount),
    depositAmount: Number(row.depositAmount),
  }));
};

const getMerchantReservationDetail = async ({ reservationId, branchId }, db = prisma) => {
  const reservations = await db.$queryRaw(Prisma.sql`
    SELECT reservation.*
    FROM "ProductReservation" reservation
    WHERE reservation."id" = ${reservationId}
      AND reservation."branchId" = ${branchId}
    LIMIT 1
  `);
  const reservation = reservations[0];
  if (!reservation) return null;

  const [items, timeline] = await Promise.all([
    db.$queryRaw(Prisma.sql`
      SELECT item."id", item."lineId", item."lineType", item."productId",
             item."stockItemId", item."simpleLotId", item."quantity",
             item."basePrice", item."discount", item."price", item."vatAmount",
             item."remark", item."isActive", item."createdAt", item."updatedAt",
             product."name" AS "productName"
      FROM "ProductReservationItem" item
      JOIN "Product" product ON product."id" = item."productId"
      WHERE item."reservationId" = ${reservationId}
      ORDER BY item."id"
    `),
    db.$queryRaw(Prisma.sql`
      SELECT event."id", command."commandType", event."fromStatus", event."toStatus",
             event."actorId", event."reason", event."occurredAt", event."createdAt"
      FROM "ProductReservationLifecycleEvent" event
      JOIN "ProductReservationLifecycleCommand" command
        ON command."id" = event."commandId"
      WHERE event."reservationId" = ${reservationId}
        AND event."branchId" = ${branchId}
      ORDER BY event."occurredAt", event."id"
    `),
  ]);

  return {
    reservation: {
      ...reservation,
      id: Number(reservation.id),
      version: Number(reservation.version),
      totalBeforeDiscount: Number(reservation.totalBeforeDiscount),
      totalDiscount: Number(reservation.totalDiscount),
      totalAmount: Number(reservation.totalAmount),
      depositAmount: Number(reservation.depositAmount),
    },
    items: items.map((item) => ({
      ...item,
      id: Number(item.id),
      productId: Number(item.productId),
      stockItemId: item.stockItemId == null ? null : Number(item.stockItemId),
      simpleLotId: item.simpleLotId == null ? null : Number(item.simpleLotId),
      quantity: Number(item.quantity),
      basePrice: Number(item.basePrice),
      discount: Number(item.discount),
      price: Number(item.price),
      vatAmount: Number(item.vatAmount),
    })),
    timeline: timeline.map((event) => ({
      ...event,
      id: Number(event.id),
      actorId: event.actorId == null ? null : Number(event.actorId),
    })),
  };
};

const findExpiredCandidates = async ({ branchId = null, now, limit }, db = prisma) => {
  const normalizedLimit = normalizeLimit(limit, 100, 500);
  const branchFilter = branchId == null ? Prisma.empty : Prisma.sql`AND "branchId" = ${branchId}`;
  const rows = await db.$queryRaw(Prisma.sql`
    SELECT "id", "branchId", "version", "expiresAt"
    FROM "ProductReservation"
    WHERE "status" = 'ACTIVE'
      AND "expiresAt" IS NOT NULL
      AND "expiresAt" <= ${now}
      ${branchFilter}
    ORDER BY "expiresAt", "id"
    LIMIT ${normalizedLimit}
  `);
  return rows.map((row) => ({
    id: Number(row.id),
    branchId: Number(row.branchId),
    version: Number(row.version),
    expiresAt: row.expiresAt,
  }));
};

module.exports = Object.freeze({
  listMerchantReservations,
  getMerchantReservationDetail,
  findExpiredCandidates,
});
