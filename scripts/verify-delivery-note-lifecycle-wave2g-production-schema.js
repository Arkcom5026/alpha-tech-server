'use strict';

const { PrismaClient } = require('@prisma/client');

const EXPECTED_MIGRATION = '20260821163500_delivery_note_lifecycle_wave2_persistence';

const fail = (message) => {
  throw new Error(message);
};

const main = async () => {
  const prisma = new PrismaClient();
  try {
    const migrationRows = await prisma.$queryRaw`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      WHERE migration_name = ${EXPECTED_MIGRATION}
      ORDER BY finished_at DESC NULLS LAST
      LIMIT 1
    `;
    const migration = migrationRows[0];
    if (!migration || !migration.finished_at || migration.rolled_back_at) {
      fail(`Migration ${EXPECTED_MIGRATION} is not applied successfully`);
    }

    const tableRows = await prisma.$queryRawUnsafe(`
      SELECT
        to_regclass('"DeliveryNoteDocument"')::text AS document_table,
        to_regclass('"DeliveryNoteDocumentLine"')::text AS line_table,
        to_regclass('"DeliveryNoteDocumentReturnSource"')::text AS return_table
    `);
    const tables = tableRows[0] || {};
    if (!tables.document_table || !tables.line_table || !tables.return_table) {
      fail('One or more Delivery Note lifecycle persistence tables are missing');
    }

    const constraints = await prisma.$queryRawUnsafe(`
      SELECT conname
      FROM pg_constraint
      WHERE conname IN (
        'DeliveryNoteDocument_currentKey_check',
        'DeliveryNoteDocument_replacesDocumentId_fkey',
        'DeliveryNoteDocumentLine_deliveryNoteDocumentId_fkey',
        'DeliveryNoteDocumentReturnSource_deliveryNoteDocumentId_fkey'
      )
    `);
    const constraintNames = new Set(constraints.map((row) => row.conname));
    for (const name of [
      'DeliveryNoteDocument_currentKey_check',
      'DeliveryNoteDocument_replacesDocumentId_fkey',
      'DeliveryNoteDocumentLine_deliveryNoteDocumentId_fkey',
      'DeliveryNoteDocumentReturnSource_deliveryNoteDocumentId_fkey',
    ]) {
      if (!constraintNames.has(name)) fail(`Missing Delivery Note lifecycle constraint: ${name}`);
    }

    // PostgreSQL truncates identifiers to 63 bytes. Verify index authority by
    // table + indexed column definition instead of relying on long Prisma names.
    const indexes = await prisma.$queryRawUnsafe(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename IN (
          'DeliveryNoteDocument',
          'DeliveryNoteDocumentLine',
          'DeliveryNoteDocumentReturnSource'
        )
    `);

    const hasIndex = (table, requiredColumns, unique = true) => indexes.some((row) => {
      if (row.tablename !== table) return false;
      const def = String(row.indexdef || '');
      if (unique && !/CREATE UNIQUE INDEX/i.test(def)) return false;
      return requiredColumns.every((column) => def.includes(`"${column}"`));
    });

    const expectedIndexes = [
      ['DeliveryNoteDocument', ['documentNumber']],
      ['DeliveryNoteDocument', ['currentKey']],
      ['DeliveryNoteDocument', ['branchId', 'saleId', 'revisionNumber']],
      ['DeliveryNoteDocumentLine', ['deliveryNoteDocumentId', 'sourceLineType', 'sourceLineId']],
      ['DeliveryNoteDocumentReturnSource', ['deliveryNoteDocumentId', 'saleReturnId']],
    ];

    for (const [table, columns] of expectedIndexes) {
      if (!hasIndex(table, columns, true)) {
        fail(`Missing Delivery Note lifecycle unique index on ${table}(${columns.join(', ')})`);
      }
    }

    const counts = await prisma.$queryRawUnsafe(`
      SELECT
        (SELECT COUNT(*)::int FROM "DeliveryNoteDocument") AS documents,
        (SELECT COUNT(*)::int FROM "DeliveryNoteDocumentLine") AS lines,
        (SELECT COUNT(*)::int FROM "DeliveryNoteDocumentReturnSource") AS return_sources
    `);

    console.log('Delivery Note lifecycle Wave 2G production schema verification: PASS');
    console.log(JSON.stringify({
      migration: EXPECTED_MIGRATION,
      finishedAt: migration.finished_at,
      existingRows: counts[0] || { documents: 0, lines: 0, return_sources: 0 },
      mode: 'READ_ONLY',
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
