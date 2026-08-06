'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { assertTestDatabaseAuthority } = require('../../../../../recovery/testDatabaseAuthority');

const MODES = Object.freeze({
  TEST_DB: 'TEST_DB',
  MAIN_TEST_TENANT: 'MAIN_TEST_TENANT',
});

const MAIN_TEST_TENANT = Object.freeze({
  branchId: 13,
  branchSlug: 'test-shop',
});

const MAIN_DB_WRITE_APPROVAL = 'ALPHATECH_MAIN_DB_TEST_TENANT_WRITE';

const normalizeMode = (value) => {
  const mode = String(value || MODES.TEST_DB).trim().toUpperCase();
  if (!Object.values(MODES).includes(mode)) {
    throw new Error(
      `SALE_COMPLETION_E2E_DATABASE_MODE must be ${MODES.TEST_DB} or ${MODES.MAIN_TEST_TENANT}.`
    );
  }
  return mode;
};

const loadEnvFile = (fileName, options = {}) => {
  const envPath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(envPath)) {
    if (options.required) throw new Error(`Missing ${fileName}.`);
    return null;
  }
  dotenv.config({ path: envPath, override: Boolean(options.override) });
  return envPath;
};

const requireValue = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
};

const resolveSaleCompletionE2ERuntimeAuthority = ({ requiresWrite = false } = {}) => {
  const mode = normalizeMode(process.env.SALE_COMPLETION_E2E_DATABASE_MODE);

  if (mode === MODES.TEST_DB) {
    loadEnvFile('.env.restore', { required: true, override: true });
    const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
    const authorityEnv = { ...process.env };
    delete authorityEnv.DATABASE_URL;
    delete authorityEnv.DIRECT_URL;
    const authority = assertTestDatabaseAuthority({
      targetUrl,
      env: authorityEnv,
      requiresWriteApproval: requiresWrite,
    });

    return Object.freeze({
      mode,
      environment: 'TEST',
      targetUrl,
      target: authority.target,
      expectedBranch: null,
    });
  }

  loadEnvFile('.env', { required: false, override: false });
  const targetUrl = requireValue('DATABASE_URL');

  if (
    requiresWrite
    && process.env.SALE_COMPLETION_E2E_MAIN_DB_WRITE_APPROVAL !== MAIN_DB_WRITE_APPROVAL
  ) {
    throw new Error(
      `Set SALE_COMPLETION_E2E_MAIN_DB_WRITE_APPROVAL=${MAIN_DB_WRITE_APPROVAL} before provisioning.`
    );
  }

  const configuredBranchId = Number(
    process.env.SALE_COMPLETION_E2E_ALLOWED_BRANCH_ID || MAIN_TEST_TENANT.branchId
  );
  const configuredBranchSlug = String(
    process.env.SALE_COMPLETION_E2E_ALLOWED_BRANCH_SLUG || MAIN_TEST_TENANT.branchSlug
  ).trim();

  if (
    configuredBranchId !== MAIN_TEST_TENANT.branchId
    || configuredBranchSlug !== MAIN_TEST_TENANT.branchSlug
  ) {
    throw new Error(
      `Main-DB Sale E2E is fixed to branchId=${MAIN_TEST_TENANT.branchId}, `
        + `slug=${MAIN_TEST_TENANT.branchSlug}.`
    );
  }

  return Object.freeze({
    mode,
    environment: 'MAIN_TEST_TENANT',
    targetUrl,
    target: 'normal DATABASE_URL with fixed Main-DB test tenant',
    expectedBranch: MAIN_TEST_TENANT,
  });
};

module.exports = Object.freeze({
  MODES,
  MAIN_TEST_TENANT,
  MAIN_DB_WRITE_APPROVAL,
  resolveSaleCompletionE2ERuntimeAuthority,
});
