'use strict';

const crypto = require('crypto');
const { prisma, Prisma } = require('../../../../../lib/prisma');

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

const mapSession = (row, items = []) => ({
  status: row.status,
  expiresAt: row.expiresAt,
  lastActivityAt: row.lastActivityAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  items: items.map((item) => {
    const quantity = Number(item.quantity);
    const availableQuantity = Number(item.availableQuantity || 0);
    const priceOnline = item.priceOnline == null ? null : Number(item.priceOnline);
    return {
      productId: Number(item.productId),
      quantity,
      name: item.name || null,
      priceOnline,
      availableQuantity,
      valid: priceOnline != null && priceOnline > 0 && availableQuantity >= quantity,
    };
  }),
});

const findStorefrontBySlug = async (slug, db = prisma) => {
  const rows = await db.$queryRaw(Prisma.sql`
    SELECT psc."branchId"
    FROM "PartnerStoreCapability" psc
    WHERE psc."storefrontSlug" = ${slug}
      AND psc."storefrontEnabled" = TRUE
    LIMIT 1
  `);
  return rows[0] || null;
};

const findActiveRecordByToken = async ({ branchId, token }, db = prisma) => {
  const tokenHash = hashToken(token);
  const rows = await db.$queryRaw(Prisma.sql`
    SELECT *
    FROM "AnonymousShoppingSession"
    WHERE "branchId" = ${branchId}
      AND "publicTokenHash" = ${tokenHash}
      AND "status" = 'ACTIVE'
      AND "expiresAt" > CURRENT_TIMESTAMP
    LIMIT 1
  `);
  return rows[0] || null;
};

const loadItems = async (sessionId, branchId, db = prisma) => db.$queryRaw(Prisma.sql`
  SELECT item."productId", item."quantity", product."name",
    price."priceOnline",
    GREATEST(COALESCE(balance."quantity", 0) - COALESCE(balance."reserved", 0), 0) AS "availableQuantity"
  FROM "AnonymousShoppingSessionItem" item
  JOIN "Product" product ON product."id" = item."productId"
  LEFT JOIN "BranchPrice" price
    ON price."productId" = item."productId"
   AND price."branchId" = ${branchId}
   AND price."isActive" = TRUE
   AND (price."effectiveDate" IS NULL OR price."effectiveDate" <= CURRENT_TIMESTAMP)
   AND (price."expiredDate" IS NULL OR price."expiredDate" > CURRENT_TIMESTAMP)
  LEFT JOIN "StockBalance" balance
    ON balance."productId" = item."productId"
   AND balance."branchId" = ${branchId}
  WHERE item."sessionId" = ${sessionId}
  ORDER BY item."id"
`);

const findActiveByToken = async ({ branchId, token }, db = prisma) => {
  const row = await findActiveRecordByToken({ branchId, token }, db);
  if (!row) return null;
  return mapSession(row, await loadItems(row.id, branchId, db));
};

const create = async ({ branchId, token, expiresAt }, db = prisma) => {
  const tokenHash = hashToken(token);
  const rows = await db.$queryRaw(Prisma.sql`
    INSERT INTO "AnonymousShoppingSession" (
      "branchId", "publicTokenHash", "status", "expiresAt",
      "lastActivityAt", "createdAt", "updatedAt"
    ) VALUES (
      ${branchId}, ${tokenHash}, 'ACTIVE', ${expiresAt},
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING *
  `);
  return mapSession(rows[0], []);
};

const upsertItem = async ({ branchId, token, productId, quantity }, db = prisma) => db.$transaction(async (tx) => {
  const session = await findActiveRecordByToken({ branchId, token }, tx);
  if (!session) return null;

  const products = await tx.$queryRaw(Prisma.sql`
    SELECT p."id", bp."priceOnline",
      GREATEST(COALESCE(balance."quantity", 0) - COALESCE(balance."reserved", 0), 0) AS "availableQuantity"
    FROM "Product" p
    JOIN "BranchPrice" bp ON bp."productId" = p."id" AND bp."branchId" = ${branchId}
    LEFT JOIN "StockBalance" balance
      ON balance."productId" = p."id" AND balance."branchId" = ${branchId}
    WHERE p."id" = ${productId}
      AND p."active" = TRUE
      AND bp."isActive" = TRUE
      AND bp."priceOnline" IS NOT NULL
      AND bp."priceOnline" > 0
      AND (bp."effectiveDate" IS NULL OR bp."effectiveDate" <= CURRENT_TIMESTAMP)
      AND (bp."expiredDate" IS NULL OR bp."expiredDate" > CURRENT_TIMESTAMP)
    LIMIT 1
  `);
  const product = products[0];
  if (!product) {
    throw Object.assign(new Error('Product is not publicly available'), {
      statusCode: 404,
      code: 'ANONYMOUS_SESSION_PRODUCT_NOT_AVAILABLE',
    });
  }
  if (Number(product.availableQuantity || 0) < quantity) {
    throw Object.assign(new Error('Requested quantity exceeds available stock'), {
      statusCode: 409,
      code: 'ANONYMOUS_SESSION_STOCK_INSUFFICIENT',
      details: {
        productId,
        requestedQuantity: quantity,
        availableQuantity: Number(product.availableQuantity || 0),
      },
    });
  }

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "AnonymousShoppingSessionItem" (
      "sessionId", "productId", "quantity", "createdAt", "updatedAt"
    ) VALUES (
      ${session.id}, ${productId}, ${quantity}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("sessionId", "productId") DO UPDATE SET
      "quantity" = EXCLUDED."quantity",
      "updatedAt" = CURRENT_TIMESTAMP
  `);

  await tx.$executeRaw(Prisma.sql`
    UPDATE "AnonymousShoppingSession"
    SET "lastActivityAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${session.id}
  `);

  const refreshed = await findActiveRecordByToken({ branchId, token }, tx);
  return refreshed ? mapSession(refreshed, await loadItems(refreshed.id, branchId, tx)) : null;
});

const removeItem = async ({ branchId, token, productId }, db = prisma) => db.$transaction(async (tx) => {
  const session = await findActiveRecordByToken({ branchId, token }, tx);
  if (!session) return null;
  await tx.$executeRaw(Prisma.sql`
    DELETE FROM "AnonymousShoppingSessionItem"
    WHERE "sessionId" = ${session.id} AND "productId" = ${productId}
  `);
  await tx.$executeRaw(Prisma.sql`
    UPDATE "AnonymousShoppingSession"
    SET "lastActivityAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${session.id}
  `);
  const refreshed = await findActiveRecordByToken({ branchId, token }, tx);
  return refreshed ? mapSession(refreshed, await loadItems(refreshed.id, branchId, tx)) : null;
});

const abandon = async ({ branchId, token }, db = prisma) => {
  const tokenHash = hashToken(token);
  const count = await db.$executeRaw(Prisma.sql`
    UPDATE "AnonymousShoppingSession"
    SET "status" = 'ABANDONED',
        "abandonedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "branchId" = ${branchId}
      AND "publicTokenHash" = ${tokenHash}
      AND "status" = 'ACTIVE'
  `);
  return Number(count) > 0;
};

module.exports = Object.freeze({
  hashToken,
  findStorefrontBySlug,
  findActiveByToken,
  create,
  upsertItem,
  removeItem,
  abandon,
});