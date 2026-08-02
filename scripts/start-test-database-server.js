'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const dotenv = require('dotenv');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const envPath = path.join(process.cwd(), '.env.restore');
if (!fs.existsSync(envPath)) {
  throw new Error('Missing .env.restore. Configure the dedicated Test DB before starting a Test API server.');
}

dotenv.config({ path: envPath, override: true });

const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
assertTestDatabaseAuthority({
  targetUrl,
  env: process.env,
  requiresWriteApproval: true,
});

const child = spawn(process.execPath, ['server.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    DATABASE_URL: targetUrl,
    DIRECT_URL: targetUrl,
    ALPHATECH_RUNTIME_ENV: 'TEST',
    CORS_ALLOW_ALL: 'true',
    PORT: process.env.TEST_API_PORT || '3000',
  },
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on('SIGINT', () => {
    if (child.exitCode === null) child.kill('SIGINT');
  });
  process.on('SIGTERM', () => {
    if (child.exitCode === null) child.kill('SIGTERM');
  });
  break;
}

child.on('error', (error) => {
  console.error(`TEST_DATABASE_SERVER_FAILED: ${error.message || error}`);
  process.exitCode = 1;
});

child.on('close', (code) => {
  process.exitCode = code || 0;
});
