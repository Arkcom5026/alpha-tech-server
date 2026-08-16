'use strict';

// Restores only an approved public + legacy_tax recovery bundle into the
// explicitly configured Test database, then verifies every manifest count.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { Client } = require('pg');
const { assertTestDatabaseAuthority } = require('./testDatabaseAuthority');
const { requirePostgresTool } = require('./postgresClientTools');

require('dotenv').config({ path: path.join(process.cwd(), '.env.restore') });

const EXPECTED_SCHEMAS = ['public', 'legacy_tax'];
const RESET_CONFIRMATION = 'ALPHATECH_TEST_DB_RESET';
const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;

function fail(message) { console.error(`RECOVERY_BUNDLE_RESTORE_FAILED: ${message}`); process.exit(1); }
function checksum(filePath) { return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex'); }
function quoteIdent(value) { return `"${String(value).replace(/"/g, '""')}"`; }

function connectionEnvironment(value) {
  const url = new URL(value);
  return { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: url.searchParams.get('sslmode') || 'require' };
}

function clientConfig(value) {
  const url = new URL(value);
  url.searchParams.delete('sslmode');
  return { connectionString: url.toString(), ssl: String(value).includes('supabase') ? { rejectUnauthorized: false } : false };
}

function parseArgs(argv) {
  const result = {
    manifestPath: String(process.env.RESTORE_BUNDLE_MANIFEST || '').trim() || null,
    yes: process.env.RESTORE_DATABASE_RESET_CONFIRMATION === RESET_CONFIRMATION,
  };
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === '--manifest') { result.manifestPath = argv[++index]; continue; }
    if (argv[index] === '--yes') { result.yes = true; continue; }
    fail(`Unknown argument: ${argv[index]}`);
  }
  return result;
}

function runPsql(psqlPath, sqlPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(psqlPath, ['--set', 'ON_ERROR_STOP=1', '--file', sqlPath], { cwd: process.cwd(), env: connectionEnvironment(targetUrl), shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || `psql exited with code ${code}`)));
  });
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.yes) fail('Explicit --yes or RESTORE_DATABASE_RESET_CONFIRMATION is required before resetting the Test database.');
  if (!args.manifestPath) fail('Usage: node recovery/restoreRecoveryBundle.js --manifest <bundle.manifest.json> --yes, or set RESTORE_BUNDLE_MANIFEST.');
  if (!targetUrl) fail('RESTORE_DATABASE_URL or RECOVERY_DATABASE_URL is required.');

  let psql;
  try {
    psql = requirePostgresTool('psql', { explicitPath: process.env.PSQL_PATH });
  } catch (error) {
    fail(error.message || String(error));
  }

  assertTestDatabaseAuthority({ targetUrl, requiresWriteApproval: true, requiresResetApproval: true });

  const manifestPath = path.resolve(args.manifestPath);
  if (!fs.existsSync(manifestPath)) fail(`Manifest file not found: ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.recoveryBundleVersion !== 'ALPHATECH_PG_DUMP_PUBLIC_LEGACY_TAX_V1') fail('Manifest is not an approved public + legacy_tax recovery bundle.');
  if (JSON.stringify(manifest.schemas) !== JSON.stringify(EXPECTED_SCHEMAS)) fail('Manifest schema scope must be exactly public and legacy_tax.');
  const sqlPath = manifest.files?.sqlFilePath || path.join(path.dirname(manifestPath), manifest.files?.sqlFileName || '');
  if (!sqlPath || !fs.existsSync(sqlPath)) fail('Bundle SQL file not found.');
  if (checksum(sqlPath) !== manifest.files.sha256) fail('Bundle SQL SHA256 mismatch.');

  const client = new Client(clientConfig(targetUrl));
  try {
    await client.connect();
    await client.query('DROP SCHEMA IF EXISTS "public" CASCADE');
    await client.query('DROP SCHEMA IF EXISTS "legacy_tax" CASCADE');
  } finally {
    await client.end().catch(() => undefined);
  }

  await runPsql(psql.path, sqlPath);

  const verifyClient = new Client(clientConfig(targetUrl));
  try {
    await verifyClient.connect();
    const mismatches = [];
    for (const [key, expected] of Object.entries(manifest.tableCounts || {})) {
      const [schema, table] = key.split('.', 2);
      const result = await verifyClient.query(`SELECT COUNT(*)::bigint AS count FROM ${quoteIdent(schema)}.${quoteIdent(table)}`);
      const actual = Number(result.rows[0].count);
      if (actual !== Number(expected)) mismatches.push({ table: key, expected: Number(expected), actual });
    }
    if (mismatches.length) fail(`Row-count verification failed: ${JSON.stringify(mismatches)}`);
  } finally {
    await verifyClient.end().catch(() => undefined);
  }

  console.log(JSON.stringify({ result: 'PASS', restoredSchemas: EXPECTED_SCHEMAS, databaseModified: true, psqlMajor: psql.major, verifiedTables: Object.keys(manifest.tableCounts || {}).length }, null, 2));
}

main().catch((error) => fail(error.message || String(error)));
