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

    const indexes = await prisma.$queryRawUnsafe(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND indexname IN (
          'DeliveryNoteDocument_documentNumber_key',
          'DeliveryNoteDocument_currentKey_key',
          'DeliveryNoteDocument_branchId_saleId_revisionNumber_key',
          'DeliveryNoteDocumentLine_deliveryNoteDocumentId_sourceLineType_sourceLineId_key',
          'DeliveryNoteDocumentReturnSource_deliveryNoteDocumentId_saleReturnId_key'
        )
    `);
    const indexNames = new Set(indexes.map((row) => row.indexname));
    for (const name of [
      'DeliveryNoteDocument_documentNumber_key',
      'DeliveryNoteDocument_currentKey_key',
      'DeliveryNoteDocument_branchId_saleId_revisionNumber_key',
      'DeliveryNoteDocumentLine_deliveryNoteDocumentId_sourceLineType_sourceLineId_key',
      'DeliveryNoteDocumentReturnSource_deliveryNoteDocumentId_saleReturnId_key',
    ]) {
      if (!indexNames.has(name)) fail(`Missing Delivery Note lifecycle index: ${name}`);
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
