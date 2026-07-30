'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const envPath = path.join(process.cwd(), '.env.restore');
if (!fs.existsSync(envPath)) {
  throw new Error('Missing .env.restore. Copy .env.restore.example and configure the dedicated Test DB.');
}

dotenv.config({ path: envPath, override: true });

const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
const authority = assertTestDatabaseAuthority({ targetUrl, env: process.env });
const reportDir = path.join(process.cwd(), 'recovery', 'reports');
const reportPath = path.join(reportDir, 'test-database-schema-diff.latest.sql');

fs.mkdirSync(reportDir, { recursive: true });

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(
  command,
  ['prisma', 'migrate', 'diff', '--from-schema-datasource', 'prisma', '--to-schema-datamodel', 'prisma', '--script'],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: targetUrl,
      DIRECT_URL: targetUrl,
    },
    encoding: 'utf8',
  }
);

const output = `${result.stdout || ''}${result.stderr || ''}`;
fs.writeFileSync(reportPath, output, 'utf8');

if (result.error || result.status !== 0) {
  const diagnostic = {
    error: result.error ? result.error.message : null,
    exitCode: result.status,
    signal: result.signal,
    reportPath,
  };

  console.error('TEST_DATABASE_SCHEMA_DIFF_FAILED');
  console.error(JSON.stringify(diagnostic, null, 2));
  if (output.trim()) {
    console.error(output.trim());
  }
  process.exitCode = result.status || 1;
} else {
  const empty = output.includes('-- This is an empty migration.');
  console.log(JSON.stringify({
    result: empty ? 'ALIGNED' : 'DRIFT_DETECTED',
    authority: authority.target,
    databaseModified: false,
    reportPath,
  }, null, 2));
}
