'use strict';

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const MIGRATION_NAME = '20260810104500_vat_carry_forward_authority';
const TABLE_NAME = 'VatCarryForwardAuthority';

const prisma = new PrismaClient();

const fail = (message, details = undefined) => {
  const error = new Error(message);
  if (details) error.details = details;
  throw error;
};

const run = async () => {
  const migrations = await prisma.$queryRawUnsafe(`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    WHERE migration_name = '${MIGRATION_NAME}'
  `);

  if (migrations.length !== 1) {
    fail('Expected exactly one VAT carry-forward migration record', { migrationCount: migrations.length });
  }

  const migration = migrations[0];
  if (!migration.finished_at || migration.rolled_back_at) {
    fail('VAT carry-forward migration is not in a successful terminal state', {
      finishedAt: migration.finished_at,
      rolledBackAt: migration.rolled_back_at,
    });
  }

  const tableRows = await prisma.$queryRawUnsafe(`
    SELECT to_regclass('public."${TABLE_NAME}"')::text AS "tableName"
  `);
  const tableName = tableRows[0]?.tableName || null;
  if (tableName !== TABLE_NAME) {
    fail('VAT carry-forward table was not found in public schema', { tableName });
  }

  const countRows = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS count
    FROM "${TABLE_NAME}"
  `);
  const rowCount = Number(countRows[0]?.count ?? -1);
  if (rowCount !== 0) {
    fail('VAT carry-forward migration must not backfill authority rows', { rowCount });
  }

  console.log(JSON.stringify({
    ok: true,
    migration: {
      name: migration.migration_name,
      finishedAt: migration.finished_at,
      rolledBackAt: migration.rolled_back_at,
    },
    table: tableName,
    rowCount,
  }, null, 2));
};

run()
  .catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      message: error.message,
      details: error.details || null,
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
