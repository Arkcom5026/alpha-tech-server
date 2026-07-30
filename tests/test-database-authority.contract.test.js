'use strict';

const assert = require('assert');
const {
  RESET_APPROVAL,
  TEST_DATABASE_HOST,
  TEST_DATABASE_PROJECT_REF,
  WRITE_APPROVAL,
  inspectTestDatabaseAuthority,
} = require('../recovery/testDatabaseAuthority');

const targetUrl = `postgresql://postgres:secret@${TEST_DATABASE_HOST}:5432/postgres?sslmode=require`;
const baseEnv = {
  RESTORE_DATABASE_ENVIRONMENT: 'TEST',
  RESTORE_DATABASE_PROJECT_REF: TEST_DATABASE_PROJECT_REF,
};

{
  const result = inspectTestDatabaseAuthority({ targetUrl, env: baseEnv });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.target.host, TEST_DATABASE_HOST);
}

{
  const result = inspectTestDatabaseAuthority({
    targetUrl,
    env: { ...baseEnv, RESTORE_DATABASE_WRITE_APPROVAL: WRITE_APPROVAL },
    requiresWriteApproval: true,
  });
  assert.strictEqual(result.ok, true);
}

{
  const result = inspectTestDatabaseAuthority({
    targetUrl,
    env: {
      ...baseEnv,
      RESTORE_DATABASE_WRITE_APPROVAL: WRITE_APPROVAL,
      RESTORE_DATABASE_RESET_APPROVAL: RESET_APPROVAL,
    },
    requiresWriteApproval: true,
    requiresResetApproval: true,
  });
  assert.strictEqual(result.ok, true);
}

{
  const result = inspectTestDatabaseAuthority({
    targetUrl,
    env: { ...baseEnv, DATABASE_URL: targetUrl },
  });
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((message) => message.includes('DATABASE_URL')));
}

{
  const result = inspectTestDatabaseAuthority({
    targetUrl: 'postgresql://postgres:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require',
    env: baseEnv,
  });
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((message) => message.includes('Restore target host')));
}

{
  const result = inspectTestDatabaseAuthority({
    targetUrl,
    env: { ...baseEnv, RESTORE_DATABASE_PROJECT_REF: 'wrong-project' },
  });
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors.some((message) => message.includes('RESTORE_DATABASE_PROJECT_REF')));
}

console.log('test database authority contract: PASS');
