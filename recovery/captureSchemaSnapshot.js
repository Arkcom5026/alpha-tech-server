'use strict';

// Capture a production schema with pg_dump. This command is read-only.
require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const sourceUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const outputDir = process.env.BACKUP_OUTPUT_DIR || path.join(process.cwd(), 'backups');
const pgDumpPath = process.env.PG_DUMP_PATH || path.join(process.env.POSTGRES_CLIENT_BIN || '', 'pg_dump.exe');

function fail(message) { console.error(`SCHEMA_SNAPSHOT_FAILED: ${message}`); process.exit(1); }
function checksum(filePath) { return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex'); }

function connectionEnvironment(value) {
  const url = new URL(value);
  return { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: url.searchParams.get('sslmode') || 'require' };
}

async function main() {
  if (!sourceUrl) fail('DIRECT_URL or DATABASE_URL is required.');
  if (!pgDumpPath || !fs.existsSync(pgDumpPath)) fail('PG_DUMP_PATH or POSTGRES_CLIENT_BIN must point to PostgreSQL 17 pg_dump.exe.');
  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const schemaPath = path.join(outputDir, `alphatech_schema_snapshot_${stamp}.sql`);
  // The data backup exports only the application-owned public schema.  Do not
  // include Supabase-managed schemas such as auth, storage, or vault.
  const child = spawn(pgDumpPath, ['--schema-only', '--schema=public', '--no-owner', '--no-privileges', '--quote-all-identifiers', '--file', schemaPath], { cwd: process.cwd(), env: connectionEnvironment(sourceUrl), shell: false, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || `pg_dump exited with code ${code}`))); });
  console.log(JSON.stringify({ result: 'PASS', databaseModified: false, schemaPath, sha256: checksum(schemaPath) }, null, 2));
}

main().catch((error) => fail(error.message || String(error)));
