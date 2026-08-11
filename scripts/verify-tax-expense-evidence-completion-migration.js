'use strict';

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const MIGRATION_NAME = '20260811120500_tax_expense_evidence_completion';
const ENUM_NAME = 'TaxExpenseLifecycleEventType';
const ENUM_VALUE = 'EVIDENCE_VERIFIED';
const prisma = new PrismaClient();

const fail = (message, details) => {
  const error = new Error(message);
  error.details = details;
  throw error;
};

const run = async () => {
  const migrations = await prisma.$queryRawUnsafe(`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    WHERE migration_name = '${MIGRATION_NAME}'
  `);
  if (migrations.length !== 1) fail('Expected exactly one tax expense evidence migration record', { migrationCount: migrations.length });
  const migration = migrations[0];
  if (!migration.finished_at || migration.rolled_back_at) {
    fail('Tax expense evidence migration is not successful', {
      finishedAt: migration.finished_at,
      rolledBackAt: migration.rolled_back_at,
    });
  }

  const labels = await prisma.$queryRawUnsafe(`
    SELECT e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = '${ENUM_NAME}'
    ORDER BY e.enumsortorder
  `);
  const enumValues = labels.map((row) => String(row.enumlabel));
  if (!enumValues.includes(ENUM_VALUE)) fail('Evidence verified lifecycle enum value is missing', { enumValues });

  console.log(JSON.stringify({
    ok: true,
    migration: {
      name: migration.migration_name,
      finishedAt: migration.finished_at,
      rolledBackAt: migration.rolled_back_at,
    },
    enumName: ENUM_NAME,
    enumValue: ENUM_VALUE,
  }, null, 2));
};

run()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, message: error.message, details: error.details || null }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
