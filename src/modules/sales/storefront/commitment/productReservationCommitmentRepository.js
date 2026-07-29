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
    SELECT reservation."id", reservation."code", reservation."status",
           reservation."totalAmount", reservation."expiresAt", reservation."createdAt",
           reservation."anonymousSessionId", reservation."commerceIdentityId",
           session."publicTokenHash", identity."proofTokenHash"
    FROM "ProductReservation" reservation
    JOIN "AnonymousShoppingSession" session
      ON session."id" = reservation."anonymousSessionId"
    JOIN "CommerceCommitmentIdentity" identity
      ON identity."id" = reservation."commerceIdentityId"
    WHERE reservation."branchId" = ${branchId}
      AND reservation."actorType" = 'COMMERCE_IDENTITY'
      AND reservation."idempotencyKey" = ${idempotencyKey}
    LIMIT 1
  `);
  return rows[0] || null;
};

const assertMatchingReplay = ({ existing, sessionTokenHash, proofTokenHash }) => {
  if (!existing) return null;
  if (existing.publicTokenHash !== sessionTokenHash || existing.proofTokenHash !== proofTokenHash) {
    conflict('COMMITMENT_IDEMPOTENCY_CONFLICT', 'Idempotency key was already used by a different commitment command');
  }
  return {
    replayed: true,
    reservation: {
      id: Number(existing.id),
      code: existing.code,
      status: existing.status,
      totalAmount: Number(existing.totalAmount),
      expiresAt: existing.expiresAt,
      createdAt: existing.createdAt,
    },
  };
};

const commit = async ({ branchId, sessionTokenHash, proofTokenHash, idempotencyKey, code, reservationExpiresAt }, db = prisma) => db.$transaction(async (tx) => {
  const replay = assertMatchingReplay({
    existing: await findExistingByIdempotency({ branchId, idempotencyKey }, tx),
    sessionTokenHash,
    proofTokenHash,
  });
  if (replay) return replay;

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
      AND bp."isActive" = TRUE
      AND bp."priceOnline" IS NOT NULL
      AND bp."priceOnline" > 0
      AND (bp."effectiveDate" IS NULL OR bp."effectiveDate" <= CURRENT_TIMESTAMP)
      AND (bp."expiredDate" IS NULL OR bp."expiredDate" > CURRENT_TIMESTAMP)
    FOR UPDATE OF bp
  `);
  if (prices.length !== productIds.length) {
    conflict('COMMITMENT_PRODUCT_NOT_AVAILABLE', 'One or more products are no longer publicly available');
  }

  const priceByProduct = new Map(prices.map((row) => [Number(row.productId), row.priceOnline]));
  const reservationItems = [];
  let totalAmountCents = 0;

  for (const item of items) {
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);
    const priceDecimal = priceByProduct.get(productId);
    const unitPriceCents = Math.round(Number(priceDecimal) * 100);
    if (!Number.isSafeInteger(unitPriceCents)) {
      conflict('COMMITMENT_PRICE_INVALID', 'Online price could not be represented safely', { productId });
    }

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

    totalAmountCents += unitPriceCents * quantity;
    if (!Number.isSafeInteger(totalAmountCents)) {
      conflict('COMMITMENT_TOTAL_INVALID', 'Reservation total exceeded the safe numeric range');
    }
    reservationItems.push({ productId, quantity, unitPriceCents });
  }

  const totalAmount = (totalAmountCents / 100).toFixed(2);
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
    const unitPrice = (line.unitPriceCents / 100).toFixed(2);
    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "ProductReservationItem" (
        "reservationId", "lineId", "lineType", "productId", "stockItemId", "simpleLotId",
        "quantity", "basePrice", "discount", "price", "vatAmount", "isActive",
        "createdAt", "updatedAt"
      ) VALUES (
        ${reservation.id}, ${`PUBLIC-${index + 1}`}, 'SIMPLE', ${line.productId}, NULL, NULL,
        ${line.quantity}, ${unitPrice}, 0, ${unitPrice}, 0, TRUE,
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

  const proofConsumed = await tx.$executeRaw(Prisma.sql`
    UPDATE "CommerceCommitmentIdentity"
    SET "consumedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${proof.id} AND "consumedAt" IS NULL
  `);
  if (Number(proofConsumed) !== 1) {
    conflict('COMMITMENT_IDENTITY_PROOF_CONFLICT', 'Commitment identity proof was already consumed');
  }

  const challengeConsumed = await tx.$executeRaw(Prisma.sql`
    UPDATE "CommerceIdentityChallenge"
    SET "status" = 'CONSUMED',
        "consumedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${proof.challengeId} AND "status" = 'VERIFIED'
  `);
  if (Number(challengeConsumed) !== 1) {
    conflict('COMMITMENT_IDENTITY_CHALLENGE_CONFLICT', 'Identity challenge could not be consumed');
  }

  const sessionCommitted = await tx.$executeRaw(Prisma.sql`
    UPDATE "AnonymousShoppingSession"
    SET "status" = 'COMMITTED',
        "committedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${session.id} AND "status" = 'ACTIVE'
  `);
  if (Number(sessionCommitted) !== 1) {
    conflict('COMMITMENT_SESSION_CONFLICT', 'Anonymous shopping session could not be committed');
  }

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