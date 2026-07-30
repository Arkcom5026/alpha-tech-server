'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const MIGRATION_APPROVAL = 'ALPHATECH_TEST_DB_MIGRATE';
const FOUNDATION_MIGRATIONS = [
  '20260728183000_supplier_payable_foundation',
  '20260728193000_supplier_payment_allocation_authority',
  '20260728203000_supplier_advance_credit_authority',
  '20260728213000_supplier_dispute_adjustment_authority',
  '20260728223000_pos_held_cart_foundation',
];

const root = process.cwd();
const envPath = path.join(root, '.env.restore');
if (!fs.existsSync(envPath)) {
  throw new Error('Missing .env.restore. Configure the dedicated Test DB before synchronizing migration history.');
}

dotenv.config({ path: envPath, override: true });

if (process.env.RESTORE_DATABASE_MIGRATION_APPROVAL !== MIGRATION_APPROVAL) {
  throw new Error(`TEST_DATABASE_AUTHORITY_REJECTED: RESTORE_DATABASE_MIGRATION_APPROVAL must equal ${MIGRATION_APPROVAL}.`);
}

const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
const authority = assertTestDatabaseAuthority({
  targetUrl,
  env: process.env,
  requiresWriteApproval: true,
});

const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
if (!fs.existsSync(prismaCli)) {
  throw new Error('Prisma CLI is not installed locally. Run npm ci before using the Test-only migration resolver.');
}

console.log(`TEST_PRISMA_RESOLVE_TARGET: ${authority.target.host}:${authority.target.port}/${authority.target.database}`);

for (const migration of FOUNDATION_MIGRATIONS) {
  const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'resolve', '--applied', migration], {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: targetUrl,
      DIRECT_URL: targetUrl,
      ALPHATECH_RUNTIME_ENV: 'TEST',
    },
    stdio: 'inherit',
  });

  if (result.error || result.status !== 0) {
    throw new Error(`TEST_PRISMA_RESOLVE_FAILED: ${migration}`);
  }
}

console.log(`test Prisma foundation ledger: PASS (${authority.target.host}:${authority.target.port}/${authority.target.database})`);
