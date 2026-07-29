'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const conflict = (code, message, details = null, statusCode = 409) => {
  throw Object.assign(new Error(message), { code, statusCode, details });
};

const projectReservation = (row) => row && Object.freeze({
  id: Number(row.id),
  code: row.code,
  branchId: Number(row.branchId),
  status: row.status,
  stockReleasedAt: row.stockReleasedAt || null,
  version: Number(row.version),
  totalAmount: row.totalAmount == null ? null : Number(row.totalAmount),
  expiresAt: row.expiresAt || null,
  createdAt: row.createdAt || null,
  updatedAt: row.updatedAt || null,
});

const findCommandReplay = async ({ reservationId, branchId, commandKey }, db = prisma) => {
  const rows = await db.$queryRaw(Prisma.sql`
    SELECT command."commandType", command."stockReleased",
           reservation."id", reservation."code", reservation."branchId", reservation."status",
           reservation."stockReleasedAt", reservation."version", reservation."totalAmount",
           reservation."expiresAt", reservation."createdAt", reservation."updatedAt"
    FROM "ProductReservationLifecycleCommand" command
    JOIN "ProductReservation" reservation ON reservation."id" = command."reservationId"
    WHERE command."reservationId" = ${reservationId}
      AND command."branchId" = ${branchId}
      AND command."commandKey" = ${commandKey}
      AND reservation."branchId" = ${branchId}
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;
  return Object.freeze({
    commandType: row.commandType,
    stockReleased: Boolean(row.stockReleased),
    reservation: projectReservation(row),
  });
};

const findForLifecycleCommand = async ({ reservationId, branchId }, db = prisma) => {
  const rows = await db.$queryRaw(Prisma.sql`
    SELECT "id", "code", "branchId", "status", "stockReleasedAt", "version",
           "totalAmount", "expiresAt", "createdAt", "updatedAt"
    FROM "ProductReservation"
    WHERE "id" = ${reservationId}
      AND "branchId" = ${branchId}
    LIMIT 1
  `);
  return projectReservation(rows[0] || null);
};

const executeLifecycleTransition = async ({ command, transition, current }, db = prisma) => db.$transaction(async (tx) => {
  const lockedRows = await tx.$queryRaw(Prisma.sql`
    SELECT "id", "code", "branchId", "status", "stockReleasedAt", "version",
           "totalAmount", "expiresAt", "createdAt", "updatedAt"
    FROM "ProductReservation"
    WHERE "id" = ${command.reservationId}
      AND "branchId" = ${command.branchId}
    FOR UPDATE
  `);
  const locked = lockedRows[0];
  if (!locked) {
    conflict('PRODUCT_RESERVATION_NOT_FOUND', 'ProductReservation was not found in the authorized branch', {
      reservationId: command.reservationId,
      branchId: command.branchId,
    }, 404);
  }

  const replay = await findCommandReplay({
    reservationId: command.reservationId,
    branchId: command.branchId,
    commandKey: command.commandKey,
  }, tx);
  if (replay) {
    if (replay.commandType !== command.commandType) {
      conflict('PRODUCT_RESERVATION_COMMAND_REPLAY_CONFLICT', 'Lifecycle command key was already used for a different command', {
        commandKey: command.commandKey,
        existingCommandType: replay.commandType,
        requestedCommandType: command.commandType,
      });
    }
    return Object.freeze({ reservation: replay.reservation, stockReleased: replay.stockReleased, replayed: true });
  }

  if (Number(locked.version) !== Number(current.version) || locked.status !== current.status) {
    conflict('PRODUCT_RESERVATION_VERSION_CONFLICT', 'ProductReservation lifecycle state changed before the command could be committed', {
      reservationId: command.reservationId,
      expectedVersion: current.version,
      actualVersion: Number(locked.version),
      expectedStatus: current.status,
      actualStatus: locked.status,
    });
  }

  if (transition.releaseStock && locked.stockReleasedAt) {
    conflict('PRODUCT_RESERVATION_STOCK_ALREADY_RELEASED', 'ProductReservation stock has already been released', {
      reservationId: command.reservationId,
      stockReleasedAt: locked.stockReleasedAt,
    });
  }

  let stockReleased = false;
  if (transition.releaseStock) {
    const lines = await tx.$queryRaw(Prisma.sql`
      SELECT "productId", SUM("quantity") AS "quantity"
      FROM "ProductReservationItem"
      WHERE "reservationId" = ${command.reservationId}
        AND "isActive" = TRUE
      GROUP BY "productId"
      ORDER BY "productId"
      FOR UPDATE
    `);

    for (const line of lines) {
      const productId = Number(line.productId);
      const quantity = Number(line.quantity);
      const changed = await tx.$executeRaw(Prisma.sql`
        UPDATE "StockBalance"
        SET "reserved" = "reserved" - ${quantity},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "productId" = ${productId}
          AND "branchId" = ${command.branchId}
          AND "reserved" >= ${quantity}
      `);
      if (Number(changed) !== 1) {
        conflict('PRODUCT_RESERVATION_RESERVED_STOCK_CONFLICT', 'Reserved stock could not be released safely', {
          reservationId: command.reservationId,
          branchId: command.branchId,
          productId,
          quantity,
        });
      }

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "StockMovement" (
          "productId", "branchId", "qty", "type", "refType", "refId", "note",
          "performedByEmployeeId", "createdAt", "occurredAt"
        ) VALUES (
          ${productId}, ${command.branchId}, ${quantity},
          'RELEASE'::"StockMovementType", 'PRODUCT_RESERVATION', ${command.reservationId},
          ${`Reservation ${locked.code} ${transition.toStatus.toLowerCase()}`}, ${command.actorId},
          CURRENT_TIMESTAMP, ${command.occurredAt}
        )
      `);
    }
    stockReleased = true;
  }

  const updatedRows = await tx.$queryRaw(Prisma.sql`
    UPDATE "ProductReservation"
    SET "status" = ${transition.toStatus}::"ProductReservationStatus",
        "stockReleasedAt" = CASE WHEN ${transition.releaseStock} THEN ${command.occurredAt} ELSE "stockReleasedAt" END,
        "version" = "version" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${command.reservationId}
      AND "branchId" = ${command.branchId}
      AND "version" = ${Number(current.version)}
      AND "status" = ${transition.fromStatus}::"ProductReservationStatus"
    RETURNING "id", "code", "branchId", "status", "stockReleasedAt", "version",
              "totalAmount", "expiresAt", "createdAt", "updatedAt"
  `);
  if (updatedRows.length !== 1) {
    conflict('PRODUCT_RESERVATION_VERSION_CONFLICT', 'ProductReservation lifecycle update lost optimistic concurrency', {
      reservationId: command.reservationId,
      expectedVersion: current.version,
    });
  }

  const commandRows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "ProductReservationLifecycleCommand" (
      "reservationId", "branchId", "commandKey", "commandType", "fromStatus", "toStatus",
      "stockReleased", "actorId", "reason", "occurredAt", "createdAt"
    ) VALUES (
      ${command.reservationId}, ${command.branchId}, ${command.commandKey},
      ${command.commandType}::"ProductReservationLifecycleCommandType",
      ${transition.fromStatus}::"ProductReservationStatus", ${transition.toStatus}::"ProductReservationStatus",
      ${stockReleased}, ${command.actorId}, ${command.reason}, ${command.occurredAt}, CURRENT_TIMESTAMP
    ) RETURNING "id"
  `);
  const commandId = Number(commandRows[0].id);

  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "ProductReservationLifecycleEvent" (
      "reservationId", "branchId", "commandId", "fromStatus", "toStatus",
      "actorId", "reason", "occurredAt", "createdAt"
    ) VALUES (
      ${command.reservationId}, ${command.branchId}, ${commandId},
      ${transition.fromStatus}::"ProductReservationStatus", ${transition.toStatus}::"ProductReservationStatus",
      ${command.actorId}, ${command.reason}, ${command.occurredAt}, CURRENT_TIMESTAMP
    )
  `);

  return Object.freeze({
    reservation: projectReservation(updatedRows[0]),
    stockReleased,
    replayed: false,
  });
});

module.exports = Object.freeze({
  findCommandReplay,
  findForLifecycleCommand,
  executeLifecycleTransition,
});
