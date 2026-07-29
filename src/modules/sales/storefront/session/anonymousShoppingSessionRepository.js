'use strict';

const crypto = require('crypto');
const { prisma, Prisma } = require('../../../../../lib/prisma');

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

const mapSession = (row, items = []) => ({
  id: Number(row.id),
  branchId: Number(row.branchId),
  status: row.status,
  expiresAt: row.expiresAt,
  lastActivityAt: row.lastActivityAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  items: items.map((item) => ({
    productId: Number(item.productId),
    quantity: Number(item.quantity),
  })),
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

const findActiveByToken = async ({ branchId, token }, db = prisma) => {
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
  if (!rows[0]) return null;
  const items = await db.$queryRaw(Prisma.sql`
    SELECT "productId", "quantity"
    FROM "AnonymousShoppingSessionItem"
    WHERE "sessionId" = ${rows[0].id}
    ORDER BY "id"
  `);
  return mapSession(rows[0], items);
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
  const session = await findActiveByToken({ branchId, token }, tx);
  if (!session) return null;

  const products = await tx.$queryRaw(Prisma.sql`
    SELECT p."id"
    FROM "Product" p
    JOIN "BranchPrice" bp ON bp."productId" = p."id" AND bp."branchId" = ${branchId}
    WHERE p."id" = ${productId}
      AND p."active" = TRUE
      AND bp."active" = TRUE
      AND bp."priceOnline" IS NOT NULL
      AND bp."priceOnline" > 0
    LIMIT 1
  `);
  if (!products[0]) {
    throw Object.assign(new Error('Product is not publicly available'), {
      statusCode: 404,
      code: 'ANONYMOUS_SESSION_PRODUCT_NOT_AVAILABLE',
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

  return findActiveByToken({ branchId, token }, tx);
});

const removeItem = async ({ branchId, token, productId }, db = prisma) => db.$transaction(async (tx) => {
  const session = await findActiveByToken({ branchId, token }, tx);
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
  return findActiveByToken({ branchId, token }, tx);
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
