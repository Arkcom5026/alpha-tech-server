'use strict';

// Test-only post-restore verifier. It never connects to the source database.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { Client } = require('pg');
const { assertTestDatabaseAuthority } = require('../testDatabaseAuthority');

const ROOT_DIR = process.cwd();
const RESTORE_ENV_PATH = path.join(ROOT_DIR, '.env.restore');
const REPORT_DIR = process.env.VERIFY_REPORT_DIR || path.join(ROOT_DIR, 'recovery', 'reports');
const VERSION = 'ALPHATECH-RECOVERY-VERIFY-V2-TEST-ONLY';

function parseArgs(argv) {
  const args = { manifestPath: null };
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--manifest' || value === '-m') {
      args.manifestPath = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return args;
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function qualifiedTable(schemaName, tableName) {
  return `${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`;
}

function buildPgConfig(connectionString) {
  const parsed = new URL(connectionString);
  parsed.searchParams.delete('sslmode');
  return {
    connectionString: parsed.toString(),
    ssl: parsed.hostname.includes('supabase.co') ? { rejectUnauthorized: false } : false,
  };
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function resolveSqlPath(manifest, manifestPath) {
  const candidates = [
    manifest?.files?.sqlFilePath,
    manifest?.files?.sqlFileName && path.join(path.dirname(manifestPath), manifest.files.sqlFileName),
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

async function verifyManifestRows(client, schemaName, tables) {
  const results = [];
  for (const [tableName, metadata] of Object.entries(tables || {})) {
    const expected = Number(metadata?.rowCount || 0);
    try {
      const result = await client.query(`SELECT COUNT(*)::bigint AS count FROM ${qualifiedTable(schemaName, tableName)};`);
      const actual = Number(result.rows[0].count);
      results.push({ tableName, expected, actual, passed: actual === expected });
    } catch (error) {
      results.push({ tableName, expected, actual: null, passed: false, error: error.message });
    }
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.manifestPath) throw new Error('Missing --manifest path.');
  if (!fs.existsSync(RESTORE_ENV_PATH)) throw new Error('Missing .env.restore.');

  dotenv.config({ path: RESTORE_ENV_PATH, override: true });
  const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
  if (!targetUrl) throw new Error('Missing RESTORE_DATABASE_URL or RECOVERY_DATABASE_URL in .env.restore.');

  const authority = assertTestDatabaseAuthority({
    targetUrl,
    requiresWriteApproval: false,
    requiresResetApproval: false,
  });

  const manifestPath = path.resolve(args.manifestPath);
  if (!fs.existsSync(manifestPath)) throw new Error(`Manifest file not found: ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const sqlPath = resolveSqlPath(manifest, manifestPath);
  if (!sqlPath || !manifest?.files?.sha256) throw new Error('Manifest does not contain a verifiable SQL artifact.');
  const checksumPassed = sha256File(sqlPath) === manifest.files.sha256;
  if (!checksumPassed) throw new Error('SQL artifact checksum does not match the manifest.');

  const schemaName = process.env.RESTORE_SCHEMA || 'public';
  const client = new Client(buildPgConfig(targetUrl));
  let rows;
  let databaseVersion;
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    databaseVersion = (await client.query('SHOW server_version')).rows[0].server_version;
    rows = await verifyManifestRows(client, schemaName, manifest.tables);
    await client.query('ROLLBACK');
  } finally {
    await client.end().catch(() => undefined);
  }

  const mismatches = rows.filter((entry) => !entry.passed);
  const report = {
    verifyVersion: VERSION,
    checkedAt: new Date().toISOString(),
    result: mismatches.length === 0 ? 'PASS' : 'FAIL',
    databaseModified: false,
    transactionReadOnly: true,
    target: authority.target,
    schema: schemaName,
    postgresVersion: databaseVersion,
    manifestPath,
    artifactChecksum: { passed: checksumPassed },
    tables: rows,
    mismatches,
  };

  ensureDirectory(REPORT_DIR);
  const reportPath = path.join(REPORT_DIR, 'verification-report.latest.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({ result: report.result, target: report.target, checkedTables: rows.length, mismatches: mismatches.length, reportPath }, null, 2));
  process.exitCode = mismatches.length === 0 ? 0 : 2;
}

main().catch((error) => {
  console.error(`RECOVERY_VERIFICATION_FAILED: ${error.message}`);
  process.exitCode = 1;
});
