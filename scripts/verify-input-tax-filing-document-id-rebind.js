'use strict';

const { prisma } = require('../src/lib/prisma');

const MIGRATION_NAME = '20260811181500_input_tax_filing_document_id_rebind';

const fail = (message, details = {}) => {
  const error = new Error(message);
  error.details = details;
  throw error;
};

const main = async () => {
  const [columns, constraints, orphanRows, migrationRows] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'InputTaxFilingItem'
        AND column_name = 'taxDocumentId'
    `),
    prisma.$queryRawUnsafe(`
      SELECT pg_get_constraintdef(constraint_row.oid) AS definition
      FROM pg_constraint constraint_row
      JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
      JOIN pg_namespace namespace_row ON namespace_row.oid = table_row.relnamespace
      WHERE namespace_row.nspname = 'public'
        AND table_row.relname = 'InputTaxFilingItem'
        AND constraint_row.conname = 'InputTaxFilingItem_taxDocumentId_fkey'
    `),
    prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS count
      FROM "InputTaxFilingItem" item
      LEFT JOIN "TaxDocument" document ON document."id" = item."taxDocumentId"
      WHERE item."taxDocumentId" IS NOT NULL
        AND document."id" IS NULL
    `),
    prisma.$queryRawUnsafe(`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      WHERE migration_name = '${MIGRATION_NAME}'
      ORDER BY started_at DESC
      LIMIT 1
    `),
  ]);

  const column = columns[0];
  const definition = String(constraints[0]?.definition || '');
  const orphanCount = Number(orphanRows[0]?.count || 0);
  const migration = migrationRows[0];

  if (!column || column.data_type !== 'integer') {
    fail('InputTaxFilingItem.taxDocumentId is not integer', { column });
  }
  if (!definition.includes('FOREIGN KEY ("taxDocumentId")') || !definition.includes('REFERENCES "TaxDocument"(id)')) {
    fail('InputTaxFilingItem.taxDocumentId FK is not bound to current TaxDocument(id)', { definition });
  }
  if (orphanCount !== 0) {
    fail('InputTaxFilingItem contains orphan taxDocumentId values', { orphanCount });
  }
  if (!migration || !migration.finished_at || migration.rolled_back_at) {
    fail('Input tax filing document id rebind migration is not successfully applied', { migration });
  }

  console.log('Input tax filing document id rebind verification: PASS');
  console.log(JSON.stringify({
    migration: MIGRATION_NAME,
    dataType: column.data_type,
    udtName: column.udt_name,
    foreignKey: definition,
    orphanCount,
  }, null, 2));
};

main()
  .catch((error) => {
    console.error('Input tax filing document id rebind verification: FAIL');
    console.error(error.message);
    if (error.details) console.error(JSON.stringify(error.details, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
