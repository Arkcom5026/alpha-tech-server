'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const conflict = (code, message, details) => {
  throw Object.assign(new Error(message), { statusCode: 409, code, details });
};

const create = async (command, db = prisma) => db.$transaction(async (tx) => {
  const customer = await tx.customerProfile.findFirst({
    where: { id: command.customerId },
    select: { id: true },
  });
  if (!customer) conflict('RESERVATION_CUSTOMER_NOT_FOUND', 'Customer was not found');

  const stockLines = command.items.filter((line) => line.lineType === 'STOCK_ITEM');
  const simpleLines = command.items.filter((line) => line.lineType === 'SIMPLE');

  if (stockLines.length) {
    const stockIds = stockLines.map((line) => line.stockItemId);
    const available = await tx.$queryRaw(Prisma.sql`
      SELECT stock."id", stock."productId"
      FROM "StockItem" stock
      WHERE stock."id" IN (${Prisma.join(stockIds)})
        AND stock."branchId" = ${command.branchId}
        AND stock."status"::text = 'IN_STOCK'
        AND NOT EXISTS (
          SELECT 1 FROM "ProductReservationItem" item
          WHERE item."stockItemId" = stock."id" AND item."isActive" = TRUE
        )
      FOR UPDATE
    `);
    if (available.length !== stockIds.length) {
      const found = new Set(available.map((row) => Number(row.id)));
      conflict('RESERVATION_STOCK_UNAVAILABLE', 'One or more stock items are unavailable', {
        stockItemIds: stockIds.filter((id) => !found.has(id)),
      });
    }
  }

  const simpleByProduct = new Map();
  const simpleByLot = new Map();
  for (const line of simpleLines) {
    simpleByProduct.set(line.productId, (simpleByProduct.get(line.productId) || 0) + line.quantity);
    if (line.simpleLotId) simpleByLot.set(line.simpleLotId, (simpleByLot.get(line.simpleLotId) || 0) + line.quantity);
  }

  for (const [productId, required] of simpleByProduct.entries()) {
    const changed = await tx.$executeRaw(Prisma.sql`
      UPDATE "StockBalance"
      SET "reserved" = "reserved" + ${required}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "productId" = ${productId}
        AND "branchId" = ${command.branchId}
        AND ("quantity" - "reserved") >= ${required}
    `);
    if (changed !== 1) conflict('RESERVATION_SIMPLE_STOCK_UNAVAILABLE', 'Simple product quantity is unavailable', { productId, required });
  }

  for (const [simpleLotId, required] of simpleByLot.entries()) {
    const rows = await tx.$queryRaw(Prisma.sql`
      SELECT lot."id", lot."productId", lot."qtyRemaining",
        COALESCE(SUM(item."quantity") FILTER (WHERE item."isActive" = TRUE), 0) AS "reservedQuantity"
      FROM "SimpleLot" lot
      LEFT JOIN "ProductReservationItem" item ON item."simpleLotId" = lot."id"
      WHERE lot."id" = ${simpleLotId} AND lot."branchId" = ${command.branchId}
      GROUP BY lot."id"
      FOR UPDATE OF lot
    `);
    const lot = rows[0];
    const available = Number(lot?.qtyRemaining || 0) - Number(lot?.reservedQuantity || 0);
    if (!lot || available + 0.0001 < required) {
      conflict('RESERVATION_SIMPLE_LOT_UNAVAILABLE', 'Simple lot quantity is unavailable', { simpleLotId, required, available });
    }
  }

  const reservationRows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "ProductReservation" (
      "code", "branchId", "customerId", "createdByEmployeeId", "status",
      "totalBeforeDiscount", "totalDiscount", "totalAmount", "depositAmount",
      "note", "pickupAt", "expiresAt", "createdAt", "updatedAt"
    ) VALUES (
      ${command.code}, ${command.branchId}, ${command.customerId}, ${command.employeeId}, 'ACTIVE',
      ${command.totalBeforeDiscount}, ${command.totalDiscount}, ${command.totalAmount}, 0,
      ${command.note}, ${command.pickupAt}, ${command.expiresAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) RETURNING *
  `);
  const reservation = reservationRows[0];

  for (const line of command.items) {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "ProductReservationItem" (
        "reservationId", "lineId", "lineType", "productId", "stockItemId", "simpleLotId",
        "quantity", "basePrice", "discount", "price", "vatAmount", "remark", "isActive",
        "createdAt", "updatedAt"
      ) VALUES (
        ${reservation.id}, ${line.lineId}, ${line.lineType}, ${line.productId}, ${line.stockItemId}, ${line.simpleLotId},
        ${line.quantity}, ${line.basePrice}, ${line.discount}, ${line.price}, ${line.vatAmount}, ${line.remark}, TRUE,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `);

    await tx.stockMovement.create({
      data: {
        productId: line.productId,
        branchId: command.branchId,
        type: 'RESERVE',
        qty: new Prisma.Decimal(line.lineType === 'STOCK_ITEM' ? -1 : -line.quantity),
        stockItemId: line.stockItemId,
        simpleLotId: line.simpleLotId,
        refType: 'PRODUCT_RESERVATION',
        refId: Number(reservation.id),
        performedByEmployeeId: command.employeeId,
        note: `Reservation ${command.code}`,
      },
    });
  }

  const items = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "ProductReservationItem"
    WHERE "reservationId" = ${reservation.id}
    ORDER BY "id" ASC
  `);

  return {
    reservation: {
      ...reservation,
      id: Number(reservation.id),
      branchId: Number(reservation.branchId),
      customerId: Number(reservation.customerId),
      createdByEmployeeId: Number(reservation.createdByEmployeeId),
      totalBeforeDiscount: Number(reservation.totalBeforeDiscount),
      totalDiscount: Number(reservation.totalDiscount),
      totalAmount: Number(reservation.totalAmount),
      depositAmount: Number(reservation.depositAmount),
      items: items.map((item) => ({
        ...item,
        id: Number(item.id),
        reservationId: Number(item.reservationId),
        productId: Number(item.productId),
        stockItemId: item.stockItemId == null ? null : Number(item.stockItemId),
        simpleLotId: item.simpleLotId == null ? null : Number(item.simpleLotId),
        quantity: Number(item.quantity),
        basePrice: Number(item.basePrice),
        discount: Number(item.discount),
        price: Number(item.price),
        vatAmount: Number(item.vatAmount),
      })),
    },
  };
});

module.exports = Object.freeze({ create });