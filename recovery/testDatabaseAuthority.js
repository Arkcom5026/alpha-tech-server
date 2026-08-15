'use strict';

const TEST_DATABASE_PROJECT_REF = 'engqdeyzbvnmxbnpemau';
const TEST_DATABASE_HOST = `db.${TEST_DATABASE_PROJECT_REF}.supabase.co`;
const TEST_DATABASE_POOLER_USER = `postgres.${TEST_DATABASE_PROJECT_REF}`;
const SESSION_POOLER_HOST_PATTERN = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/;
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

function inspectAllowedTestDatabaseTarget(target) {
  if (!target) return { allowed: false, connectionMode: null };

  const direct = target.host === TEST_DATABASE_HOST
    && target.port === '5432'
    && target.user === 'postgres';
  if (direct) return { allowed: true, connectionMode: 'DIRECT' };

  const sessionPooler = SESSION_POOLER_HOST_PATTERN.test(target.host)
    && target.port === '5432'
    && target.user === TEST_DATABASE_POOLER_USER;
  if (sessionPooler) return { allowed: true, connectionMode: 'SESSION_POOLER' };

  return { allowed: false, connectionMode: null };
}

function inspectTestDatabaseAuthority({
  targetUrl,
  env = process.env,
  requiresWriteApproval = false,
  requiresResetApproval = false,
} = {}) {
  const errors = [];
  const target = parseDatabaseUrl(targetUrl);
  let connectionMode = null;

  if (!target) {
    errors.push('RESTORE_DATABASE_URL must be a valid PostgreSQL connection URL.');
  } else {
    if (env.RESTORE_DATABASE_ENVIRONMENT !== 'TEST') {
      errors.push('RESTORE_DATABASE_ENVIRONMENT must equal TEST.');
    }

    if (env.RESTORE_DATABASE_PROJECT_REF !== TEST_DATABASE_PROJECT_REF) {
      errors.push(`RESTORE_DATABASE_PROJECT_REF must equal ${TEST_DATABASE_PROJECT_REF}.`);
    }

    const targetAuthority = inspectAllowedTestDatabaseTarget(target);
    connectionMode = targetAuthority.connectionMode;
    if (!targetAuthority.allowed) {
      errors.push(
        `Restore target must be ${TEST_DATABASE_HOST}:5432 as postgres or a Supabase Session Pooler on port 5432 as ${TEST_DATABASE_POOLER_USER}.`
      );
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
      ? {
          host: target.host,
          port: target.port,
          database: target.database,
          projectRef: TEST_DATABASE_PROJECT_REF,
          connectionMode,
        }
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
  SESSION_POOLER_HOST_PATTERN,
  TEST_DATABASE_HOST,
  TEST_DATABASE_POOLER_USER,
  TEST_DATABASE_PROJECT_REF,
  WRITE_APPROVAL,
  assertTestDatabaseAuthority,
  inspectTestDatabaseAuthority,
};
