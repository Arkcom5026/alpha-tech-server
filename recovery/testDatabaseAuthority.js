'use strict';

const TEST_DATABASE_PROJECT_REF = 'engqdeyzbvnmxbnpemau';
const TEST_DATABASE_HOST = `db.${TEST_DATABASE_PROJECT_REF}.supabase.co`;
const WRITE_APPROVAL = 'ALPHATECH_TEST_DB_WRITE';
const RESET_APPROVAL = 'ALPHATECH_TEST_DB_RESET';

function parseDatabaseUrl(connectionString) {
  try {
    const url = new URL(connectionString);
    return {
      host: url.hostname.toLowerCase(),
      port: url.port || '5432',
      database: url.pathname.replace(/^\//, '') || '(default)',
      user: decodeURIComponent(url.username || ''),
    };
  } catch (_) {
    return null;
  }
}

function sameDatabase(left, right) {
  return left && right
    && left.host === right.host
    && left.port === right.port
    && left.database === right.database
    && left.user === right.user;
}

function inspectTestDatabaseAuthority({
  targetUrl,
  env = process.env,
  requiresWriteApproval = false,
  requiresResetApproval = false,
} = {}) {
  const errors = [];
  const target = parseDatabaseUrl(targetUrl);

  if (!target) {
    errors.push('RESTORE_DATABASE_URL must be a valid PostgreSQL connection URL.');
  } else {
    if (env.RESTORE_DATABASE_ENVIRONMENT !== 'TEST') {
      errors.push('RESTORE_DATABASE_ENVIRONMENT must equal TEST.');
    }

    if (env.RESTORE_DATABASE_PROJECT_REF !== TEST_DATABASE_PROJECT_REF) {
      errors.push(`RESTORE_DATABASE_PROJECT_REF must equal ${TEST_DATABASE_PROJECT_REF}.`);
    }

    if (target.host !== TEST_DATABASE_HOST) {
      errors.push(`Restore target host must equal ${TEST_DATABASE_HOST}.`);
    }

    for (const variableName of ['DATABASE_URL', 'DIRECT_URL', 'PRODUCTION_DATABASE_URL']) {
      const source = parseDatabaseUrl(env[variableName]);
      if (sameDatabase(target, source)) {
        errors.push(`Restore target must not match ${variableName}.`);
      }
    }
  }

  if (requiresWriteApproval && env.RESTORE_DATABASE_WRITE_APPROVAL !== WRITE_APPROVAL) {
    errors.push(`RESTORE_DATABASE_WRITE_APPROVAL must equal ${WRITE_APPROVAL} before writing the Test DB.`);
  }

  if (requiresResetApproval && env.RESTORE_DATABASE_RESET_APPROVAL !== RESET_APPROVAL) {
    errors.push(`RESTORE_DATABASE_RESET_APPROVAL must equal ${RESET_APPROVAL} before resetting the Test DB schema.`);
  }

  return {
    ok: errors.length === 0,
    errors,
    target: target
      ? { host: target.host, port: target.port, database: target.database, projectRef: TEST_DATABASE_PROJECT_REF }
      : null,
  };
}

function assertTestDatabaseAuthority(options) {
  const result = inspectTestDatabaseAuthority(options);
  if (!result.ok) {
    throw new Error(`TEST_DATABASE_AUTHORITY_REJECTED: ${result.errors.join(' ')}`);
  }
  return result;
}

module.exports = {
  RESET_APPROVAL,
  TEST_DATABASE_HOST,
  TEST_DATABASE_PROJECT_REF,
  WRITE_APPROVAL,
  assertTestDatabaseAuthority,
  inspectTestDatabaseAuthority,
};
