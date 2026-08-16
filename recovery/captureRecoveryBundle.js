'use strict';

// Creates one read-only PostgreSQL recovery bundle for the application-owned
// public and legacy_tax schemas. The exported snapshot is reused for manifest
// row counts and pg_dump, so verification refers to one source state.
require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { Client } = require('pg');
const { requirePostgresTool } = require('./postgresClientTools');

const SCHEMAS = ['public', 'legacy_tax'];
const sourceUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const outputDir = process.env.BACKUP_OUTPUT_DIR || path.join(process.cwd(), 'backups');

function fail(message) { console.error(`RECOVERY_BUNDLE_CAPTURE_FAILED: ${message}`); process.exit(1); }
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

function runDump(pgDumpPath, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(pgDumpPath, args, { cwd: process.cwd(), env, shell: false, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || `pg_dump exited with code ${code}`)));
  });
}

async function main() {
  if (!sourceUrl) fail('DIRECT_URL or DATABASE_URL is required.');

  let pgDump;
  try {
    pgDump = requirePostgresTool('pg_dump', { explicitPath: process.env.PG_DUMP_PATH });
  } catch (error) {
    fail(error.message || String(error));
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sqlPath = path.join(outputDir, `alphatech_recovery_bundle_${stamp}.sql`);
  const manifestPath = path.join(outputDir, `alphatech_recovery_bundle_${stamp}.manifest.json`);
  const client = new Client(clientConfig(sourceUrl));

  try {
    await client.connect();
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const snapshot = (await client.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
    const tableRows = (await client.query(
      'SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = ANY($1) AND table_type = $2 ORDER BY table_schema, table_name',
      [SCHEMAS, 'BASE TABLE']
    )).rows;
    const tableCounts = {};
    for (const table of tableRows) {
      const result = await client.query(`SELECT COUNT(*)::bigint AS count FROM ${quoteIdent(table.table_schema)}.${quoteIdent(table.table_name)}`);
      tableCounts[`${table.table_schema}.${table.table_name}`] = Number(result.rows[0].count);
    }

    await runDump(pgDump.path, [
      '--schema=public', '--schema=legacy_tax', `--snapshot=${snapshot}`,
      '--no-owner', '--no-privileges', '--quote-all-identifiers', '--file', sqlPath,
    ], connectionEnvironment(sourceUrl));
    await client.query('COMMIT');

    const manifest = {
      recoveryBundleVersion: 'ALPHATECH_PG_DUMP_PUBLIC_LEGACY_TAX_V1',
      createdAt: new Date().toISOString(),
      databaseModified: false,
      schemas: SCHEMAS,
      postgresClient: { pgDumpMajor: pgDump.major, pgDumpVersion: pgDump.versionText },
      files: { sqlFileName: path.basename(sqlPath), sqlFilePath: sqlPath, sha256: checksum(sqlPath) },
      tableCounts,
    };
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ result: 'PASS', databaseModified: false, pgDumpMajor: pgDump.major, sqlPath, manifestPath, sha256: manifest.files.sha256, checkedTables: Object.keys(tableCounts).length }, null, 2));
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => fail(error.message || String(error)));
