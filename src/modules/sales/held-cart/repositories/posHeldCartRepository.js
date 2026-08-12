'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');
const { fail, money } = require('../contracts/posHeldCartContract');

const mapCart = (row) => ({
  ...row,
  id: Number(row.id),
  branchId: Number(row.branchId),
  customerId: row.customerId == null ? null : Number(row.customerId),
  version: Number(row.version),
  itemCount: Number(row.itemCount || row.lines?.length || 0),
  totalBeforeDiscount: money(row.totalBeforeDiscount || 0, 'totalBeforeDiscount'),
  totalDiscount: money(row.totalDiscount || 0, 'totalDiscount'),
  totalAmount: money(row.totalAmount || 0, 'totalAmount'),
});

const list = async ({ branchId, status = 'OPEN', query = '', limit = 100 }, tx = prisma) => {
  const q = String(query || '').trim();
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT cart.*, COUNT(line."id")::int AS "itemCount",
      customer."name" AS "registeredCustomerName",
      creator."name" AS "createdByName", updater."name" AS "updatedByName",
      sale."id" AS "convertedSaleId", sale."code" AS "convertedSaleCode"
    FROM "PosHeldCart" cart
    LEFT JOIN "PosHeldCartLine" line ON line."heldCartId" = cart."id"
    LEFT JOIN "CustomerProfile" customer ON customer."id" = cart."customerId"
    LEFT JOIN "EmployeeProfile" creator ON creator."id" = cart."createdById"
    LEFT JOIN "EmployeeProfile" updater ON updater."id" = cart."updatedById"
    LEFT JOIN "Sale" sale ON sale."sourceHeldCartId" = cart."id"
    WHERE cart."branchId" = ${Number(branchId)}
      AND (${status || null}::text IS NULL OR cart."status"::text = ${status || null})
      AND (${q || null}::text IS NULL OR
        cart."code" ILIKE ${q ? `%${q}%` : null} OR
        COALESCE(cart."customerName", '') ILIKE ${q ? `%${q}%` : null} OR
        COALESCE(cart."customerPhone", '') ILIKE ${q ? `%${q}%` : null} OR
        COALESCE(customer."name", '') ILIKE ${q ? `%${q}%` : null})
    GROUP BY cart."id", customer."id", creator."id", updater."id", sale."id"
    ORDER BY cart."lastActivityAt" DESC, cart."id" DESC
    LIMIT ${Math.min(Math.max(Number(limit) || 100, 1), 200)}
  `);
  return rows.map(mapCart);
};

const detail = async ({ branchId, heldCartId }, tx = prisma, lock = false) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT cart.*, customer."name" AS "registeredCustomerName",
      sale."id" AS "convertedSaleId", sale."code" AS "convertedSaleCode"
    FROM "PosHeldCart" cart
    LEFT JOIN "CustomerProfile" customer ON customer."id" = cart."customerId"
    LEFT JOIN "Sale" sale ON sale."sourceHeldCartId" = cart."id"
    WHERE cart."id" = ${Number(heldCartId)} AND cart."branchId" = ${Number(branchId)}
    LIMIT 1
    ${lock ? Prisma.sql`FOR UPDATE OF cart` : Prisma.empty}
  `);
  if (!rows.length) fail('Held cart not found', 'HELD_CART_NOT_FOUND', 404);
  const lines = await tx.$queryRaw(Prisma.sql`
    SELECT * FROM "PosHeldCartLine"
    WHERE "heldCartId" = ${Number(heldCartId)}
    ORDER BY "sortOrder", "id"
  `);
  const adjustments = await tx.$queryRaw(Prisma.sql`
    SELECT "lineId", "priceAdjustment", "adjustmentReason", "finalPrice"
    FROM "SalePriceAdjustmentEvidence"
    WHERE "sourceType" = 'HELD_CART' AND "heldCartId" = ${Number(heldCartId)}
  `);
  const adjustmentByLine = new Map(adjustments.map((row) => [String(row.lineId), row]));
  return mapCart({
    ...rows[0],
    lines: lines.map((line) => {
      const adjustment = adjustmentByLine.get(String(line.lineKey));
      return {
        ...line,
        id: Number(line.id),
        productId: Number(line.productId),
        stockItemId: line.stockItemId == null ? null : Number(line.stockItemId),
        simpleLotId: line.simpleLotId == null ? null : Number(line.simpleLotId),
        quantity: money(line.quantity, 'quantity'),
        unitPrice: money(line.unitPrice, 'unitPrice'),
        discount: money(line.discount, 'discount'),
        priceAdjustment: Number(adjustment?.priceAdjustment || -Number(line.discount || 0)),
        adjustmentReason: adjustment?.adjustmentReason || null,
        finalPrice: adjustment ? Number(adjustment.finalPrice) : Math.max(0, Number(line.unitPrice) * Number(line.quantity) - Number(line.discount || 0)),
      };
    }),
  });
};

const replaceLines = async (tx, { heldCartId, branchId, employeeId, items }) => {
  await tx.$executeRaw(Prisma.sql`DELETE FROM "SalePriceAdjustmentEvidence" WHERE "sourceType" = 'HELD_CART' AND "heldCartId" = ${Number(heldCartId)}`);
  await tx.$executeRaw(Prisma.sql`DELETE FROM "PosHeldCartLine" WHERE "heldCartId" = ${Number(heldCartId)}`);
  for (const item of items) {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "PosHeldCartLine" (
        "heldCartId", "lineKey", "lineType", "productId", "stockItemId", "simpleLotId",
        "barcode", "productName", "modelName", "quantity", "unitPrice", "discount", "remark", "sortOrder"
      ) VALUES (
        ${Number(heldCartId)}, ${item.lineKey}, ${item.lineType}::"PosHeldCartLineType",
        ${item.productId}, ${item.stockItemId}, ${item.simpleLotId}, ${item.barcode},
        ${item.productName}, ${item.modelName}, ${item.quantity}, ${item.unitPrice},
        ${item.discount}, ${item.remark}, ${item.sortOrder}
      )
    `);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "SalePriceAdjustmentEvidence" (
        "sourceType", "heldCartId", "branchId", "lineId", "lineType", "basePrice",
        "priceAdjustment", "finalPrice", "adjustmentReason", "createdByEmployeeId"
      ) VALUES (
        'HELD_CART', ${Number(heldCartId)}, ${Number(branchId)}, ${item.lineKey}, ${item.lineType},
        ${Number(item.unitPrice) * Number(item.quantity)}, ${item.priceAdjustment}, ${item.finalPrice},
        ${item.adjustmentReason}, ${Number(employeeId)}
      )
    `);
  }
};

const create = async ({ branchId, employeeId, snapshot }, tx) => {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(28072230::int, ${Number(branchId)}::int)`);
  const month = new Date().toISOString().slice(2, 7).replace('-', '');
  const counts = await tx.$queryRaw(Prisma.sql`
    SELECT COUNT(*)::int AS count FROM "PosHeldCart"
    WHERE "branchId" = ${Number(branchId)} AND "createdAt" >= date_trunc('month', CURRENT_TIMESTAMP)
  `);
  const code = `HC-${String(branchId).padStart(2, '0')}${month}-${String(Number(counts[0]?.count || 0) + 1).padStart(4, '0')}`;
  const rows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "PosHeldCart" (
      "code", "branchId", "customerId", "customerName", "customerPhone", "note", "priceType",
      "totalBeforeDiscount", "totalDiscount", "totalAmount", "createdById", "updatedById"
    ) VALUES (
      ${code}, ${Number(branchId)}, ${snapshot.customerId}, ${snapshot.customerName},
      ${snapshot.customerPhone}, ${snapshot.note}, ${snapshot.priceType},
      ${snapshot.totalBeforeDiscount}, ${snapshot.totalDiscount}, ${snapshot.totalAmount},
      ${Number(employeeId)}, ${Number(employeeId)}
    ) RETURNING "id"
  `);
  await replaceLines(tx, { heldCartId: rows[0].id, branchId, employeeId, items: snapshot.items });
  return detail({ branchId, heldCartId: rows[0].id }, tx);
};

const update = async ({ branchId, employeeId, heldCartId, expectedVersion, snapshot }, tx) => {
  const current = await detail({ branchId, heldCartId }, tx, true);
  if (current.status !== 'OPEN') fail('Only open held carts can be edited', 'HELD_CART_NOT_OPEN');
  if (Number(current.version) !== Number(expectedVersion)) {
    fail('Held cart was updated by another session', 'HELD_CART_VERSION_CONFLICT', 409, {
      expectedVersion: Number(expectedVersion), currentVersion: Number(current.version),
    });
  }
  await tx.$executeRaw(Prisma.sql`
    UPDATE "PosHeldCart"
    SET "customerId" = ${snapshot.customerId}, "customerName" = ${snapshot.customerName},
      "customerPhone" = ${snapshot.customerPhone}, "note" = ${snapshot.note},
      "priceType" = ${snapshot.priceType}, "totalBeforeDiscount" = ${snapshot.totalBeforeDiscount},
      "totalDiscount" = ${snapshot.totalDiscount}, "totalAmount" = ${snapshot.totalAmount},
      "updatedById" = ${Number(employeeId)}, "lastActivityAt" = CURRENT_TIMESTAMP,
      "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${Number(heldCartId)}
  `);
  await replaceLines(tx, { heldCartId, branchId, employeeId, items: snapshot.items });
  return detail({ branchId, heldCartId }, tx);
};

const cancel = async ({ branchId, heldCartId, employeeId, reason }, tx) => {
  const current = await detail({ branchId, heldCartId }, tx, true);
  if (current.status === 'CANCELLED') return { replayed: true, ...current };
  if (current.status !== 'OPEN') fail('Converted held cart cannot be cancelled', 'HELD_CART_NOT_OPEN');
  await tx.$executeRaw(Prisma.sql`
    UPDATE "PosHeldCart"
    SET "status" = 'CANCELLED', "cancelledById" = ${Number(employeeId)},
      "cancelledAt" = CURRENT_TIMESTAMP, "cancelReason" = ${reason},
      "updatedById" = ${Number(employeeId)}, "lastActivityAt" = CURRENT_TIMESTAMP,
      "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${Number(heldCartId)}
  `);
  return { replayed: false, ...(await detail({ branchId, heldCartId }, tx)) };
};

module.exports = Object.freeze({ cancel, create, detail, list, update });
