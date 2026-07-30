'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const runnerPath = path.join(root, 'scripts', 'run-test-prisma-migrate-deploy.js');
const runner = fs.readFileSync(runnerPath, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const example = fs.readFileSync(path.join(root, '.env.restore.example'), 'utf8');

assert.match(runner, /dotenv\.config\(\{ path: envPath, override: true \}\)/);
assert.match(runner, /RESTORE_DATABASE_MIGRATION_APPROVAL/);
assert.match(runner, /ALPHATECH_TEST_DB_MIGRATE/);
assert.match(runner, /assertTestDatabaseAuthority/);
assert.match(runner, /requiresWriteApproval: true/);
assert.match(runner, /DATABASE_URL: targetUrl/);
assert.match(runner, /DIRECT_URL: targetUrl/);
assert.match(runner, /\[prismaCli, 'migrate', 'deploy'\]/);
assert.doesNotMatch(runner, /npx/);
assert.strictEqual(packageJson.scripts['migrate:test-database'], 'node scripts/run-test-prisma-migrate-deploy.js');
assert.strictEqual(packageJson.scripts['test:test-prisma-migration-runner'], 'node tests/test-prisma-migration-runner.contract.test.js');
assert.match(example, /RESTORE_DATABASE_MIGRATION_APPROVAL=ALPHATECH_TEST_DB_MIGRATE/);

console.log('test Prisma migration runner contract: PASS');
