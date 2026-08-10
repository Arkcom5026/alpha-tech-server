'use strict';

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const MIGRATION_NAMES = [
  '20260810123000_withholding_tax_workflow',
  '20260810124500_withholding_tax_treatment_audit',
];
const TABLE_NAMES = [
  'WithholdingTaxTreatmentEvent',
  'WithholdingTaxCertificate',
  'WithholdingTaxRecord',
  'WithholdingTaxFilingBatch',
  'WithholdingTaxFilingItem',
];

const prisma = new PrismaClient();

const fail = (message, details = undefined) => {
  const error = new Error(message);
  if (details) error.details = details;
  throw error;
};

const normalizeRegclass = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;
  const withoutSchema = text.includes('.') ? text.split('.').pop() : text;
  return withoutSchema.replace(/^"|"$/g, '').replaceAll('""', '"');
};

const run = async () => {
  const migrationEvidence = [];
  for (const migrationName of MIGRATION_NAMES) {
    const migrations = await prisma.$queryRawUnsafe(`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      WHERE migration_name = '${migrationName}'
    `);
    if (migrations.length !== 1) fail('Expected exactly one WHT migration record', { migrationName, migrationCount: migrations.length });
    const migration = migrations[0];
    if (!migration.finished_at || migration.rolled_back_at) {
      fail('WHT migration is not in a successful terminal state', {
        migrationName,
        finishedAt: migration.finished_at,
        rolledBackAt: migration.rolled_back_at,
      });
    }
    migrationEvidence.push({
      name: migration.migration_name,
      finishedAt: migration.finished_at,
      rolledBackAt: migration.rolled_back_at,
    });
  }

  const tables = {};
  const rowCounts = {};
  for (const tableName of TABLE_NAMES) {
    const tableRows = await prisma.$queryRawUnsafe(`SELECT to_regclass('public."${tableName}"')::text AS "tableName"`);
    const normalized = normalizeRegclass(tableRows[0]?.tableName);
    if (normalized !== tableName) fail('Expected WHT authority table was not found', { expected: tableName, actual: tableRows[0]?.tableName || null });
    tables[tableName] = normalized;
    const countRows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${tableName}"`);
    const rowCount = Number(countRows[0]?.count ?? -1);
    if (rowCount !== 0) fail('WHT workflow migrations must not backfill authority rows', { tableName, rowCount });
    rowCounts[tableName] = rowCount;
  }

  console.log(JSON.stringify({
    ok: true,
    migrations: migrationEvidence,
    tables,
    rowCounts,
  }, null, 2));
};

run()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, message: error.message, details: error.details || null }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
