'use strict';

const { PrismaClient } = require('@prisma/client');

const TEST_URL_ENV = 'DELIVERY_NOTE_LIFECYCLE_TEST_DATABASE_URL';
const CONFIRM_ENV = 'DELIVERY_NOTE_LIFECYCLE_ALLOW_DB_TEST';
const CONFIRM_VALUE = 'YES_I_AM_USING_A_DISPOSABLE_DATABASE';
const ROLLBACK_SENTINEL = 'DELIVERY_NOTE_LIFECYCLE_WAVE2G_ROLLBACK';

const fail = (message) => {
  throw new Error(message);
};

const resolveDisposableDatabaseUrl = () => {
  const url = String(process.env[TEST_URL_ENV] || '').trim();
  if (!url) fail(`${TEST_URL_ENV} is required`);
  if (process.env[CONFIRM_ENV] !== CONFIRM_VALUE) {
    fail(`${CONFIRM_ENV} must equal ${CONFIRM_VALUE}`);
  }
  const applicationUrl = String(process.env.DATABASE_URL || '').trim();
  if (applicationUrl && applicationUrl === url) {
    fail('Refusing to use DATABASE_URL as the Wave 2G disposable test database');
  }
  return url;
};

const main = async () => {
  const url = resolveDisposableDatabaseUrl();
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const originalNumber = `W2G-DN-${suffix}`;
  const revisionNumber = `${originalNumber}-R2`;
  const currentKey = `999991:${suffix}`;

  try {
    const tables = await prisma.$queryRawUnsafe(`
      SELECT
        to_regclass('"DeliveryNoteDocument"')::text AS document_table,
        to_regclass('"DeliveryNoteDocumentLine"')::text AS line_table,
        to_regclass('"DeliveryNoteDocumentReturnSource"')::text AS return_table
    `);
    const tableRow = tables[0] || {};
    if (!tableRow.document_table || !tableRow.line_table || !tableRow.return_table) {
      fail('Wave 2 persistence tables are not present. Apply the Wave 2 migration to the disposable test database first.');
    }

    try {
      await prisma.$transaction(async (tx) => {
        const first = await tx.$queryRawUnsafe(`
          INSERT INTO "DeliveryNoteDocument" (
            "branchId", "saleId", "documentNumber", "revisionNumber", "revisionKind", "state",
            "currentKey", "grossAmount", "returnedAmount", "activeAmount", "issuedAt", "createdById",
            "snapshot", "createdAt", "updatedAt"
          ) VALUES (
            999991, 999991, $1, 1, 'ORIGINAL'::"DeliveryNoteRevisionKind", 'CURRENT'::"DeliveryNoteDocumentState",
            $2, 100.00, 0.00, 100.00, CURRENT_TIMESTAMP, 999991,
            '{"wave":"2G","kind":"original"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          ) RETURNING "id"
        `, originalNumber, currentKey);
        const firstId = Number(first[0].id);

        await tx.$executeRawUnsafe(`
          UPDATE "DeliveryNoteDocument"
          SET "state" = 'SUPERSEDED'::"DeliveryNoteDocumentState",
              "currentKey" = NULL,
              "supersededAt" = CURRENT_TIMESTAMP,
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = $1
        `, firstId);

        const second = await tx.$queryRawUnsafe(`
          INSERT INTO "DeliveryNoteDocument" (
            "branchId", "saleId", "documentNumber", "revisionNumber", "revisionKind", "state",
            "replacesDocumentId", "currentKey", "grossAmount", "returnedAmount", "activeAmount",
            "issuedAt", "createdById", "snapshot", "createdAt", "updatedAt"
          ) VALUES (
            999991, 999991, $1, 2, 'RETURN_ADJUSTMENT'::"DeliveryNoteRevisionKind", 'CURRENT'::"DeliveryNoteDocumentState",
            $2, $3, 100.00, 40.00, 60.00, CURRENT_TIMESTAMP, 999991,
            '{"wave":"2G","kind":"return-adjustment"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          ) RETURNING "id"
        `, revisionNumber, firstId, currentKey);
        const secondId = Number(second[0].id);

        await tx.$executeRawUnsafe(`
          INSERT INTO "DeliveryNoteDocumentLine" (
            "deliveryNoteDocumentId", "sourceLineType", "sourceLineId", "description",
            "originalQuantity", "returnedQuantity", "activeQuantity", "unitAmount",
            "originalAmount", "returnedAmount", "activeAmount", "sortOrder", "snapshot", "createdAt"
          ) VALUES (
            $1, 'SIMPLE'::"DeliveryNoteSourceLineType", 999991, 'Wave 2G disposable line',
            10.00, 4.00, 6.00, 10.00, 100.00, 40.00, 60.00, 0,
            '{"wave":"2G"}'::jsonb, CURRENT_TIMESTAMP
          )
        `, secondId);

        await tx.$executeRawUnsafe(`
          INSERT INTO "DeliveryNoteDocumentReturnSource" (
            "deliveryNoteDocumentId", "saleReturnId", "returnedAt", "snapshot", "createdAt"
          ) VALUES ($1, 999991, CURRENT_TIMESTAMP, '{"wave":"2G"}'::jsonb, CURRENT_TIMESTAMP)
        `, secondId);

        const chain = await tx.$queryRawUnsafe(`
          SELECT d."revisionNumber", d."state"::text AS state, d."activeAmount"::text AS active_amount,
                 d."replacesDocumentId", COUNT(l."id")::int AS line_count, COUNT(r."id")::int AS return_count
          FROM "DeliveryNoteDocument" d
          LEFT JOIN "DeliveryNoteDocumentLine" l ON l."deliveryNoteDocumentId" = d."id"
          LEFT JOIN "DeliveryNoteDocumentReturnSource" r ON r."deliveryNoteDocumentId" = d."id"
          WHERE d."documentNumber" = $1
          GROUP BY d."id"
        `, revisionNumber);
        const row = chain[0];
        if (!row || Number(row.revisionNumber) !== 2 || row.state !== 'CURRENT') fail('Revision 2 persistence invariant failed');
        if (Number(row.line_count) !== 1 || Number(row.return_count) !== 1) fail('Revision child persistence invariant failed');
        if (Number(row.active_amount) !== 60) fail('Revision active amount invariant failed');
        if (Number(row.replacesDocumentId) !== firstId) fail('Revision lineage invariant failed');

        throw new Error(ROLLBACK_SENTINEL);
      });
      fail('Wave 2G transaction unexpectedly committed');
    } catch (error) {
      if (error?.message !== ROLLBACK_SENTINEL) throw error;
    }

    const remaining = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS count
      FROM "DeliveryNoteDocument"
      WHERE "documentNumber" IN ($1, $2)
    `, originalNumber, revisionNumber);
    if (Number(remaining[0]?.count || 0) !== 0) fail('Wave 2G rollback verification failed: disposable rows remain');

    console.log('Delivery Note lifecycle Wave 2G disposable DB transaction verification: PASS');
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
