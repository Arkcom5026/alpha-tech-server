// qbrs.js
// AlphaTech Restore Tool
// P1 Hardened Backup Restore v3
//
// Safe restore tool for P1 Hardened Backup v3.
//
// v3 additions:
// - Restores SQL using Node.js + pg directly
// - No psql dependency
// - Works on Windows without PostgreSQL client tools
//
// Usage:
//   node qbrs.js --manifest "D:\alpha-tech\server\backups\file.manifest.json"
//   node qbrs.js --manifest "D:\alpha-tech\server\backups\file.manifest.json" --init
//   node qbrs.js --manifest "D:\alpha-tech\server\backups\file.manifest.json" --init --yes
//   node qbrs.js --manifest "D:\alpha-tech\server\backups\file.manifest.json" --dry-run
//   node qbrs.js --manifest "D:\alpha-tech\server\backups\file.manifest.json" --init --yes --reset-schema

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { spawn } = require('child_process');
const { Client } = require('pg');

const DOTENV_RESTORE_PATH = path.join(process.cwd(), '.env.restore');
const DOTENV_RECOVERY_PATH = path.join(process.cwd(), '.env.recovery');

require('dotenv').config({ path: DOTENV_RESTORE_PATH });
if (fs.existsSync(DOTENV_RECOVERY_PATH)) {
  require('dotenv').config({ path: DOTENV_RECOVERY_PATH, override: false });
}

const RESTORE_VERSION = 'P1-HARDENED-RESTORE-V3-NODE-PG';
const SCHEMA_NAME = process.env.RESTORE_SCHEMA || 'public';
const RESTORE_DATABASE_URL = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
const LOG_DIR = process.env.RESTORE_LOG_DIR || path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'restore.log');

const KEY_TABLES = [
  'Product',
  'BranchPrice',
  'StockItem',
  'Sale',
  'SaleItem',
  'SaleItemSimple',
  'Payment',
  'PaymentItem',
];

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function log(message) {
  ensureDir(LOG_DIR);
  const line = `[${nowIso()}] ${message}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, `${line}\n`, 'utf8');
}

function fail(message, exitCode = 1) {
  log(`❌ ${message}`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    manifestPath: null,
    yes: false,
    allowNonEmpty: false,
    dryRun: false,
    initSchema: false,
    resetSchema: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--manifest' || arg === '-m') {
      args.manifestPath = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--yes' || arg === '-y') {
      args.yes = true;
      continue;
    }

    if (arg === '--allow-non-empty') {
      args.allowNonEmpty = true;
      continue;
    }

    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (arg === '--init' || arg === '--init-schema') {
      args.initSchema = true;
      continue;
    }

    if (arg === '--reset-schema' || arg === '--reset') {
      args.resetSchema = true;
      args.initSchema = true;
      continue;
    }

    if (!args.manifestPath && !arg.startsWith('--')) {
      args.manifestPath = arg;
      continue;
    }

    fail(`Unknown argument: ${arg}`);
  }

  return args;
}

function buildPgConnectionConfig(connectionString) {
  const isSupabase = String(connectionString || '').includes('supabase');

  let normalizedConnectionString = connectionString;
  try {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    normalizedConnectionString = url.toString();
  } catch (_error) {
    normalizedConnectionString = connectionString;
  }

  return {
    connectionString: normalizedConnectionString,
    ssl: isSupabase ? { rejectUnauthorized: false } : false,
  };
}

function redactConnectionString(connectionString) {
  try {
    const url = new URL(connectionString);
    if (url.password) url.password = '***';
    return url.toString();
  } catch (_error) {
    return String(connectionString || '').replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  }
}

function describeConnection(connectionString) {
  try {
    const url = new URL(connectionString);
    return {
      host: url.hostname,
      port: url.port || '(default)',
      database: url.pathname.replace(/^\//, '') || '(unknown)',
      redacted: redactConnectionString(connectionString),
    };
  } catch (_error) {
    return {
      host: '(unknown)',
      port: '(unknown)',
      database: '(unknown)',
      redacted: redactConnectionString(connectionString),
    };
  }
}

function quoteIdent(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function qualifiedTable(schemaName, tableName) {
  return `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function resolveSqlPathFromManifest(manifest, manifestPath) {
  const candidates = [];

  if (manifest?.files?.sqlFilePath) candidates.push(manifest.files.sqlFilePath);
  if (manifest?.files?.sqlFileName) {
    candidates.push(path.join(path.dirname(manifestPath), manifest.files.sqlFileName));
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }

  return null;
}

async function askYesNo(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(`${question} `, resolve));
  rl.close();
  return ['y', 'yes'].includes(String(answer || '').trim().toLowerCase());
}

async function getBaseTableNames(client) {
  const res = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC;
  `, [SCHEMA_NAME]);

  return res.rows.map((row) => row.table_name);
}

async function getTableRowCount(client, tableName) {
  const res = await client.query(`SELECT COUNT(*)::bigint AS count FROM ${qualifiedTable(SCHEMA_NAME, tableName)};`);
  return Number(res.rows[0].count);
}

async function inspectTargetDatabase(client, manifest) {
  const existingTables = await getBaseTableNames(client);
  let totalRows = 0;

  for (const tableName of existingTables) {
    totalRows += await getTableRowCount(client, tableName);
  }

  const keyTableCounts = {};
  for (const tableName of KEY_TABLES) {
    keyTableCounts[tableName] = existingTables.includes(tableName)
      ? await getTableRowCount(client, tableName)
      : null;
  }

  const expectedTables = Object.keys(manifest?.tables || {});
  const missingExpectedTables = expectedTables.filter((tableName) => !existingTables.includes(tableName));

  return {
    existingTables,
    totalRows,
    keyTableCounts,
    expectedTables,
    missingExpectedTables,
    isEmpty: existingTables.length === 0 || totalRows === 0,
  };
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      ...options,
    });

    child.stdout.on('data', (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) {
        log(`${command}: ${line}`);
      }
    });

    child.stderr.on('data', (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) {
        log(`${command} stderr: ${line}`);
      }
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function runPrismaDbPushForRecovery() {
  if (!fs.existsSync(DOTENV_RECOVERY_PATH)) {
    fail('Missing .env.recovery. Refusing to run Prisma db push without explicit Recovery env file.');
  }

  if (!RESTORE_DATABASE_URL) {
    fail('Missing RESTORE_DATABASE_URL or RECOVERY_DATABASE_URL in .env.restore/.env.recovery.');
  }

  const recoveryEnv = {
    ...process.env,
    DATABASE_URL: RESTORE_DATABASE_URL,
    DIRECT_URL: RESTORE_DATABASE_URL,
    RESTORE_DATABASE_URL,
    RECOVERY_DATABASE_URL: RESTORE_DATABASE_URL,
  };

  log('🧱 Running Prisma db push against Recovery DB only...');
  log('🛡️ DATABASE_URL is injected from RESTORE_DATABASE_URL/RECOVERY_DATABASE_URL for this process only.');

  await runCommand('npx', ['prisma', 'db', 'push'], {
    cwd: process.cwd(),
    env: recoveryEnv,
  });

  log('✅ Prisma db push completed for Recovery DB.');
}


async function resetTargetSchema(client) {
  log(`🧨 Resetting target schema "${SCHEMA_NAME}" before restore...`);
  log('🛡️ This action is intended for Recovery / Standby DB only.');

  await client.query(`DROP SCHEMA IF EXISTS ${quoteIdent(SCHEMA_NAME)} CASCADE;`);
  await client.query(`CREATE SCHEMA ${quoteIdent(SCHEMA_NAME)};`);

  log(`✅ Schema "${SCHEMA_NAME}" reset completed.`);
}

async function runNodePgRestore({ connectionString, sqlFilePath }) {
  const sql = fs.readFileSync(sqlFilePath, 'utf8');
  const client = new Client(buildPgConnectionConfig(connectionString));

  log(`📖 SQL loaded into memory (${(Buffer.byteLength(sql, 'utf8') / 1024 / 1024).toFixed(2)} MB).`);
  log('🚚 Starting SQL restore via Node.js pg client...');

  try {
    await client.connect();
    await client.query(sql);
  } finally {
    await client.end().catch(() => undefined);
  }

  log('✅ SQL restore completed via Node.js pg client.');
}

async function verifyRestoredRows(client, manifest) {
  const mismatches = [];
  const checked = [];

  for (const [tableName, tableMeta] of Object.entries(manifest.tables || {})) {
    const expected = Number(tableMeta.rowCount || 0);
    let actual = null;
    let passed = false;

    try {
      actual = await getTableRowCount(client, tableName);
      passed = actual === expected;
    } catch (_error) {
      actual = null;
      passed = false;
    }

    checked.push({ tableName, expected, actual, passed });
    if (!passed) mismatches.push({ tableName, expected, actual });
  }

  return {
    ok: mismatches.length === 0,
    checkedTables: checked.length,
    checked,
    mismatches,
  };
}

function printInspection(inspection) {
  log(`📊 Existing tables: ${inspection.existingTables.length}`);
  log(`📦 Existing rows: ${inspection.totalRows}`);
  for (const [tableName, count] of Object.entries(inspection.keyTableCounts)) {
    log(`🔎 ${tableName}: ${count === null ? 'TABLE_NOT_FOUND' : count}`);
  }
}

async function main() {
  const startedAt = Date.now();
  const args = parseArgs(process.argv);

  log('============================================================');
  log(`🚑 AlphaTech Restore Tool ${RESTORE_VERSION}`);
  log('============================================================');

  if (!RESTORE_DATABASE_URL) {
    fail('Missing RESTORE_DATABASE_URL or RECOVERY_DATABASE_URL. Create .env.restore/.env.recovery first.');
  }

  if (!args.manifestPath) {
    fail('Missing manifest path. Usage: node qbrs.js --manifest "D:\\path\\backup.manifest.json"');
  }

  const manifestPath = path.resolve(args.manifestPath);
  if (!fs.existsSync(manifestPath)) fail(`Manifest file not found: ${manifestPath}`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const sqlFilePath = resolveSqlPathFromManifest(manifest, manifestPath);

  if (!sqlFilePath) fail('SQL file not found. Manifest sqlFilePath/sqlFileName does not point to an existing file.');
  if (!manifest?.files?.sha256) fail('Manifest has no files.sha256. Refusing restore.');

  const actualSha256 = sha256File(sqlFilePath);
  if (actualSha256 !== manifest.files.sha256) {
    fail(`SHA256 mismatch. Expected ${manifest.files.sha256}, got ${actualSha256}`);
  }

  log('✅ Manifest loaded.');
  log(`✅ SQL file: ${sqlFilePath}`);
  log(`✅ SHA256 verified: ${actualSha256}`);

  const target = describeConnection(RESTORE_DATABASE_URL);
  log(`🎯 Target DB: ${target.redacted}`);
  log(`🎯 Host: ${target.host}`);
  log(`🎯 Port: ${target.port}`);
  log(`🎯 Database: ${target.database}`);
  log(`🎯 Schema: ${SCHEMA_NAME}`);

  let client = new Client(buildPgConnectionConfig(RESTORE_DATABASE_URL));
  let inspection;

  try {
    await client.connect();
    log('🔌 Connected to target PostgreSQL successfully.');
    inspection = await inspectTargetDatabase(client, manifest);
  } finally {
    await client.end().catch(() => undefined);
  }

  printInspection(inspection);

  if (args.resetSchema) {
    if (!args.yes) {
      const ok = await askYesNo('RESET target schema before restore? This deletes Recovery DB data. Type Y to continue:');
      if (!ok) fail('Schema reset cancelled by user.', 0);
    }

    const resetClient = new Client(buildPgConnectionConfig(RESTORE_DATABASE_URL));
    try {
      await resetClient.connect();
      await resetTargetSchema(resetClient);
    } finally {
      await resetClient.end().catch(() => undefined);
    }

    await runPrismaDbPushForRecovery();

    client = new Client(buildPgConnectionConfig(RESTORE_DATABASE_URL));
    try {
      await client.connect();
      inspection = await inspectTargetDatabase(client, manifest);
    } finally {
      await client.end().catch(() => undefined);
    }

    printInspection(inspection);
  }

  if (inspection.missingExpectedTables.length > 0) {
    log(`⚠️ Target database is missing ${inspection.missingExpectedTables.length} expected tables.`);

    if (!args.initSchema) {
      log('💡 Run again with --init to run Prisma db push against Recovery DB only.');
      fail('Target schema is not ready. Restore aborted before writing data.');
    }

    if (!args.yes) {
      const ok = await askYesNo('Schema is missing. Run Prisma db push on Recovery DB now? Type Y to continue:');
      if (!ok) fail('Schema init cancelled by user.', 0);
    }

    await runPrismaDbPushForRecovery();

    client = new Client(buildPgConnectionConfig(RESTORE_DATABASE_URL));
    try {
      await client.connect();
      inspection = await inspectTargetDatabase(client, manifest);
    } finally {
      await client.end().catch(() => undefined);
    }

    printInspection(inspection);

    if (inspection.missingExpectedTables.length > 0) {
      fail(`Schema is still missing ${inspection.missingExpectedTables.length} expected tables after db push.`);
    }
  }

  if (!inspection.isEmpty && !args.allowNonEmpty) {
    fail('Target database is NOT EMPTY. Refusing restore. Use a clean Recovery DB or pass --allow-non-empty intentionally.');
  }

  if (args.dryRun) {
    log('🧪 Dry run completed. No data restored.');
    return;
  }

  if (!args.yes) {
    const ok = await askYesNo('Continue restore into this target database? Type Y to continue:');
    if (!ok) fail('Restore cancelled by user.', 0);
  }

  await runNodePgRestore({ connectionString: RESTORE_DATABASE_URL, sqlFilePath });

  const verifyClient = new Client(buildPgConnectionConfig(RESTORE_DATABASE_URL));
  await verifyClient.connect();

  const verification = await verifyRestoredRows(verifyClient, manifest);
  await verifyClient.end().catch(() => undefined);

  if (!verification.ok) {
    log(`❌ Restore verification failed. Mismatches: ${JSON.stringify(verification.mismatches, null, 2)}`);
    process.exitCode = 1;
    return;
  }

  const durationMs = Date.now() - startedAt;
  log(`✅ Restore verification PASS (${verification.checkedTables} tables checked).`);
  log(`🎉 Restore completed successfully in ${(durationMs / 1000).toFixed(2)} seconds.`);
}

main().catch((error) => {
  fail(`Restore failed: ${error.message || error}`);
});
