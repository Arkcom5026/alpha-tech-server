'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { inspectTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const envPath = path.join(process.cwd(), '.env.restore');
if (!fs.existsSync(envPath)) {
  console.error('TEST_DATABASE_AUTHORITY_REJECTED: .env.restore is missing. Copy .env.restore.example and add the TEST DB URL locally.');
  process.exit(2);
}

const loaded = dotenv.config({ path: envPath, override: true });
if (loaded.error) {
  console.error(`TEST_DATABASE_AUTHORITY_REJECTED: unable to load .env.restore: ${loaded.error.message}`);
  process.exit(2);
}

const result = inspectTestDatabaseAuthority({
  targetUrl: process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL,
  env: process.env,
});

if (!result.ok) {
  console.error(`TEST_DATABASE_AUTHORITY_REJECTED: ${result.errors.join(' ')}`);
  process.exit(2);
}

console.log(`test database authority: PASS (${result.target.host}:${result.target.port}/${result.target.database})`);
