'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const dotenv = require('dotenv');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const envPath = path.join(process.cwd(), '.env.restore');
if (!fs.existsSync(envPath)) {
  throw new Error('Missing .env.restore. Controlled migration deploy is Test-DB only.');
}

dotenv.config({ path: envPath, override: true });

const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
const authority = assertTestDatabaseAuthority({
  targetUrl,
  env: process.env,
  requiresWriteApproval: true,
});

const prismaCli = require.resolve('prisma/build/index.js');
const child = spawn(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    DATABASE_URL: targetUrl,
    DIRECT_URL: targetUrl,
    ALPHATECH_RUNTIME_ENV: 'TEST',
  },
  stdio: 'inherit',
  windowsHide: true,
});

child.on('error', (error) => {
  console.error(`DOCUMENT_REPLACEMENT_TEST_DB_MIGRATION_FAILED: ${error.message || error}`);
  process.exitCode = 1;
});

child.on('close', (code) => {
  process.exitCode = code || 0;
  if (code === 0) {
    console.log(
      `Document replacement Test DB migration deploy: PASS (${authority.target.host}:${authority.target.port}/${authority.target.database})`
    );
  }
});
