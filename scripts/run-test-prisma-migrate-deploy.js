'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const dotenv = require('dotenv');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const MIGRATION_APPROVAL = 'ALPHATECH_TEST_DB_MIGRATE';
const root = process.cwd();
const envPath = path.join(root, '.env.restore');

if (!fs.existsSync(envPath)) {
  throw new Error('Missing .env.restore. Configure the dedicated Test DB before running Prisma migrations.');
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
  throw new Error('Prisma CLI is not installed locally. Run npm ci before using the Test-only migration runner.');
}

console.log(`TEST_PRISMA_MIGRATE_TARGET: ${authority.target.host}:${authority.target.port}/${authority.target.database}`);

const child = spawn(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  cwd: root,
  env: {
    ...process.env,
    DATABASE_URL: targetUrl,
    DIRECT_URL: targetUrl,
    ALPHATECH_RUNTIME_ENV: 'TEST',
  },
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`TEST_PRISMA_MIGRATE_FAILED: ${error.message || error}`);
  process.exitCode = 1;
});

child.on('close', (code) => {
  process.exitCode = code || 0;
  if (code === 0) {
    console.log(`test Prisma migration: PASS (${authority.target.host}:${authority.target.port}/${authority.target.database})`);
  }
});
