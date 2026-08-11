'use strict';

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const MIGRATION_NAME = '20260811110000_tax_closing_finalization';
const TABLE_NAME = 'TaxClosingFinalization';

const prisma = new PrismaClient();

const fail = (message, details = undefined) => {
  const error = new Error(message);
  if (details) error.details = details;
  throw error;
};

const normalizeRegclassName = (value) => {
  if (value == null) return null;
  return String(value)
    .replace(/^public\./, '')
    .replace(/^"(.*)"$/, '$1')
    .replace(/""/g, '"');
};

const run = async () => {
  const migrations = await prisma.$queryRawUnsafe(`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    WHERE migration_name = '${MIGRATION_NAME}'
  `);
  if (migrations.length !== 1) fail('Expected exactly one tax closing finalization migration record', { migrationCount: migrations.length });

  const migration = migrations[0];
  if (!migration.finished_at || migration.rolled_back_at) {
    fail('Tax closing finalization migration is not in a successful terminal state', {
      finishedAt: migration.finished_at,
      rolledBackAt: migration.rolled_back_at,
    });
  }

  const tableRows = await prisma.$queryRawUnsafe(`SELECT to_regclass('public."${TABLE_NAME}"')::text AS "tableName"`);
  const rawTableName = tableRows[0]?.tableName || null;
  const tableName = normalizeRegclassName(rawTableName);
  if (tableName !== TABLE_NAME) fail('Tax closing finalization table was not found in public schema', { rawTableName, tableName });

  const countRows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${TABLE_NAME}"`);
  const rowCount = Number(countRows[0]?.count ?? -1);
  if (rowCount !== 0) fail('Tax closing finalization migration must not backfill authority rows', { rowCount });

  const columns = await prisma.$queryRawUnsafe(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '${TABLE_NAME}'
  `);
  const names = new Set(columns.map((row) => row.column_name));
  for (const required of ['branchId', 'taxPeriodId', 'version', 'packageVersion', 'snapshotHash', 'snapshot', 'manifest', 'finalizedById', 'finalizedAt']) {
    if (!names.has(required)) fail('Tax closing finalization column missing', { required });
  }

  console.log(JSON.stringify({
    ok: true,
    migration: { name: migration.migration_name, finishedAt: migration.finished_at, rolledBackAt: migration.rolled_back_at },
    table: tableName,
    rowCount,
    columns: [...names].sort(),
  }, null, 2));
};

run()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, message: error.message, details: error.details || null }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => { await prisma.$disconnect(); });
