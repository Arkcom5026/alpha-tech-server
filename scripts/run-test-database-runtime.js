'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const dotenv = require('dotenv');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const ALLOWED_SCRIPTS = new Set([
  'scripts/verify-partner-store-application-http-e2e.js',
  'scripts/provision-pos-sale-e2e-fixture.js',
]);
const requestedScript = process.argv[2];

if (process.argv.length !== 3 || !ALLOWED_SCRIPTS.has(requestedScript)) {
  throw new Error(`Only canonical Test DB runtimes may run through this wrapper: ${[...ALLOWED_SCRIPTS].join(', ')}.`);
}

const envPath = path.join(process.cwd(), '.env.restore');
if (!fs.existsSync(envPath)) {
  throw new Error('Missing .env.restore. Copy .env.restore.example and configure the dedicated Test DB.');
}

dotenv.config({ path: envPath, override: true });

const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
const authority = assertTestDatabaseAuthority({
  targetUrl,
  env: process.env,
  requiresWriteApproval: true,
});

const isHttpE2E = requestedScript === 'scripts/verify-partner-store-application-http-e2e.js';
const child = spawn(process.execPath, [path.join(process.cwd(), requestedScript)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    DATABASE_URL: targetUrl,
    DIRECT_URL: targetUrl,
    ALLOW_PARTNER_STORE_HTTP_E2E_TEST: isHttpE2E ? 'true' : undefined,
    ALPHATECH_RUNTIME_ENV: 'TEST',
  },
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`TEST_DATABASE_RUNTIME_FAILED: ${error.message || error}`);
  process.exitCode = 1;
});

child.on('close', (code) => {
  process.exitCode = code || 0;
  if (code === 0) {
    console.log(`test database runtime: PASS (${authority.target.host}:${authority.target.port}/${authority.target.database})`);
  }
});
