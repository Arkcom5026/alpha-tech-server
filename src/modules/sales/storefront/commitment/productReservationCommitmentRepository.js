'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const conflict = (code, message, details = null, statusCode = 409) => {
  throw Object.assign(new Error(message), { code, statusCode, details });
};

const findStorefrontBySlug = async (slug, db = prisma) => {
  const rows = await db.$queryRaw(Prisma.sql`
    SELECT "branchId"
    FROM "PartnerStoreCapability"
    WHERE "storefrontSlug" = ${slug}
      AND "storefrontEnabled" = TRUE
    LIMIT 1
  `);
  return rows[0] || null;
};

const findExistingByIdempotency = async ({ branchId, idempotencyKey }, db = prisma) => {
  const rows = await db.$queryRaw(Prisma.sql`
    SELECT "id", "code", "status", "totalAmount", "expiresAt", "createdAt"
    FROM "ProductReservation"
    WHERE "branchId" = ${branchId}
      AND "actorType" = 'COMMERCE_IDENTITY'
      AND "idempotencyKey" = ${idempotencyKey}
    LIMIT 1
  `);
  return rows[0] || null;
};

const commit = async ({ branchId, sessionTokenHash, proofTokenHash, idempotencyKey, code, reservationExpiresAt }, db = prisma) => db.$transaction(async (tx) => {
  const existing = await findExistingByIdempotency({ branchId, idempotencyKey }, tx);
  if (existing) return { replayed: true, reservation: existing };

  const sessions = await tx.$queryRaw(Prisma.sql`
    SELECT *
    FROM "AnonymousShoppingSession"
    WHERE "branchId" = ${branchId}
      AND "publicTokenHash" = ${sessionTokenHash}
    FOR UPDATE
  `);
  const session = sessions[0];
  if (!session || session.status !== 'ACTIVE' || new Date(session.expiresAt).getTime() <= Date.now()) {
    conflict('COMMITMENT_SESSION_INVALID', 'Anonymous shopping session is not active', null, 404);
  }

  const proofs = await tx.$queryRaw(Prisma.sql`
    SELECT *
    FROM "CommerceCommitmentIdentity"
    WHERE "anonymousSessionId" = ${session.id}
      AND "proofTokenHash" = ${proofTokenHash}
    FOR UPDATE
  `);
  const proof = proofs[0];
  if (!proof || proof.consumedAt || new Date(proof.expiresAt).getTime() <= Date.now()) {
    conflict('COMMITMENT_IDENTITY_PROOF_INVALID', 'Commitment identity proof is invalid or expired', null, 401);
  }

  const items = await tx.$queryRaw(Prisma.sql`
    SELECT item."productId", item."quantity"
    FROM "AnonymousShoppingSessionItem" item
    WHERE item."sessionId" = ${session.id}
    ORDER BY item."id"
    FOR UPDATE
  `);
  if (!items.length) conflict('COMMITMENT_SESSION_EMPTY', 'Anonymous shopping session has no items');

  const productIds = items.map((item) => Number(item.productId));
  const prices = await tx.$queryRaw(Prisma.sql`
    SELECT p."id" AS "productId", bp."priceOnline"
    FROM "Product" p
    JOIN "BranchPrice" bp
      ON bp."productId" = p."id"
     AND bp."branchId" = ${branchId}
    WHERE p."id" IN (${Prisma.join(productIds)})
      AND p."active" = TRUE
      AND bp."active" = TRUE
      AND bp."priceOnline" IS NOT NULL
      AND bp."priceOnline" > 0
      AND (bp."effectiveAt" IS NULL OR bp."effectiveAt" <= CURRENT_TIMESTAMP)
      AND (bp."expiresAt" IS NULL OR bp."expiresAt" > CURRENT_TIMESTAMP)
    FOR UPDATE OF bp
  `);
  if (prices.length !== productIds.length) {
    conflict('COMMITMENT_PRODUCT_NOT_AVAILABLE', 'One or more products are no longer publicly available');
  }

  const priceByProduct = new Map(prices.map((row) => [Number(row.productId), Number(row.priceOnline)]));
  let totalAmount = 0;
  const reservationItems = [];

  for (const item of items) {
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);
    const price = priceByProduct.get(productId);
    const changed = await tx.$executeRaw(Prisma.sql`
      UPDATE "StockBalance"
      SET "reserved" = "reserved" + ${quantity},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "productId" = ${productId}
        AND "branchId" = ${branchId}
        AND ("quantity" - "reserved") >= ${quantity}
    `);
    if (Number(changed) !== 1) {
      conflict('COMMITMENT_STOCK_UNAVAILABLE', 'One or more products are no longer available', { productId, quantity });
    }
    totalAmount += price * quantity;
    reservationItems.push({ productId, quantity, price });
  }

  const reservationRows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "ProductReservation" (
      "code", "branchId", "customerId", "createdByEmployeeId", "actorType",
      "commerceIdentityId", "anonymousSessionId", "idempotencyKey", "status",
      "orderSource", "sourceReference", "fulfillmentMethod",
      "totalBeforeDiscount", "totalDiscount", "totalAmount", "depositAmount",
      "expiresAt", "createdAt", "updatedAt"
    ) VALUES (
      ${code}, ${branchId}, NULL, NULL, 'COMMERCE_IDENTITY',
      ${proof.id}, ${session.id}, ${idempotencyKey}, 'ACTIVE',
      'ONLINE'::"OnlineOrderSource", ${idempotencyKey}, 'PICKUP'::"OnlineFulfillmentMethod",
      ${totalAmount}, 0, ${totalAmount}, 0,
      ${reservationExpiresAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ) RETURNING *
  `);
  const reservation = reservationRows[0];

  for (const [index, line] of reservationItems.entries()) {
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "ProductReservationItem" (
        "reservationId", "lineId", "lineType", "productId", "stockItemId", "simpleLotId",
        "quantity", "basePrice", "discount", "price", "vatAmount", "isActive",
        "createdAt", "updatedAt"
      ) VALUES (
        ${reservation.id}, ${`PUBLIC-${index + 1}`}, 'SIMPLE', ${line.productId}, NULL, NULL,
        ${line.quantity}, ${line.price}, 0, ${line.price}, 0, TRUE,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `);

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "StockMovement" (
        "productId", "branchId", "qty", "type", "refType", "refId", "note",
        "performedByEmployeeId", "createdAt", "occurredAt"
      ) VALUES (
        ${line.productId}, ${branchId}, ${-line.quantity},
        'RESERVE'::"StockMovementType", 'PRODUCT_RESERVATION', ${Number(reservation.id)},
        ${`Public reservation ${code}`}, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `);
  }

  await tx.$executeRaw(Prisma.sql`
    UPDATE "CommerceCommitmentIdentity"
    SET "consumedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${proof.id} AND "consumedAt" IS NULL
  `);

  await tx.$executeRaw(Prisma.sql`
    UPDATE "CommerceIdentityChallenge"
    SET "status" = 'CONSUMED',
        "consumedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${proof.challengeId} AND "status" = 'VERIFIED'
  `);

  await tx.$executeRaw(Prisma.sql`
    UPDATE "AnonymousShoppingSession"
    SET "status" = 'COMMITTED',
        "committedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${session.id} AND "status" = 'ACTIVE'
  `);

  return {
    replayed: false,
    reservation: {
      id: Number(reservation.id),
      code: reservation.code,
      status: reservation.status,
      totalAmount: Number(reservation.totalAmount),
      expiresAt: reservation.expiresAt,
      createdAt: reservation.createdAt,
    },
  };
});

module.exports = Object.freeze({ findStorefrontBySlug, findExistingByIdempotency, commit });
