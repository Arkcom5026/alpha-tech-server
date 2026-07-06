// qbv.js
// AlphaTech Recovery Toolkit — Verification Engine v1
// Read-only Production ↔ Recovery integrity verification.

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const RECOVERY_ENV_PATH = path.join(process.cwd(), '.env.recovery');
if (fs.existsSync(RECOVERY_ENV_PATH)) {
  require('dotenv').config({ path: RECOVERY_ENV_PATH, override: false });
}

const VERSION = 'ALPHATECH-RECOVERY-VERIFY-V1';
const SCHEMA_NAME = process.env.VERIFY_SCHEMA || 'public';
const PROD_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
const RECOVERY_URL = process.env.RECOVERY_DATABASE_URL || process.env.RESTORE_DATABASE_URL;

const REPORT_DIR = process.env.VERIFY_REPORT_DIR || path.join(process.cwd(), 'recovery', 'reports');
const LOG_FILE = path.join(REPORT_DIR, 'verify.log');
const SKIP_TABLES = new Set(['_prisma_migrations']);

function parseArgs(argv) {
  return {
    includeFingerprint: argv.includes('--include-fingerprint'),
    maxFingerprintRows: Number(process.env.VERIFY_MAX_FINGERPRINT_ROWS || 200000),
  };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function log(message) {
  ensureDir(REPORT_DIR);
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, `${line}\n`, 'utf8');
}

function quoteIdent(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function qualifiedTable(schema, table) {
  return `${quoteIdent(schema)}.${quoteIdent(table)}`;
}

function buildPgConfig(connectionString) {
  const isSupabase = String(connectionString || '').includes('supabase');
  let normalized = connectionString;
  try {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    normalized = url.toString();
  } catch (_) {}
  return { connectionString: normalized, ssl: isSupabase ? { rejectUnauthorized: false } : false };
}

function redact(connectionString) {
  try {
    const url = new URL(connectionString);
    if (url.password) url.password = '***';
    return url.toString();
  } catch (_) {
    return String(connectionString || '').replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  }
}

async function getTables(client) {
  const res = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC;
  `, [SCHEMA_NAME]);

  return res.rows.map(r => r.table_name).filter(t => !SKIP_TABLES.has(t));
}

async function getColumns(client, tableNames) {
  if (tableNames.length === 0) return new Map();

  const res = await client.query(`
    SELECT
      c.table_name,
      c.column_name,
      c.ordinal_position,
      c.data_type,
      c.udt_name,
      c.is_nullable,
      pg_catalog.format_type(a.atttypid, a.atttypmod) AS formatted_type
    FROM information_schema.columns c
    JOIN pg_catalog.pg_namespace n
      ON n.nspname = c.table_schema
    JOIN pg_catalog.pg_class cls
      ON cls.relname = c.table_name
     AND cls.relnamespace = n.oid
    JOIN pg_catalog.pg_attribute a
      ON a.attrelid = cls.oid
     AND a.attname = c.column_name
     AND a.attnum > 0
     AND NOT a.attisdropped
    WHERE c.table_schema = $1
      AND c.table_name = ANY($2)
    ORDER BY c.table_name, c.ordinal_position;
  `, [SCHEMA_NAME, tableNames]);

  const map = new Map();
  for (const row of res.rows) {
    if (!map.has(row.table_name)) map.set(row.table_name, []);
    map.get(row.table_name).push({
      name: row.column_name,
      position: row.ordinal_position,
      dataType: row.data_type,
      udtName: row.udt_name,
      formattedType: row.formatted_type,
      nullable: row.is_nullable === 'YES',
    });
  }
  return map;
}

async function getPrimaryKeys(client, tableNames) {
  if (tableNames.length === 0) return new Map();

  const res = await client.query(`
    SELECT tc.table_name, kcu.column_name, kcu.ordinal_position
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = $1
      AND tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_name = ANY($2)
    ORDER BY tc.table_name, kcu.ordinal_position;
  `, [SCHEMA_NAME, tableNames]);

  const map = new Map();
  for (const row of res.rows) {
    if (!map.has(row.table_name)) map.set(row.table_name, []);
    map.get(row.table_name).push(row.column_name);
  }
  return map;
}

async function getForeignKeys(client) {
  const res = await client.query(`
    SELECT
      con.conname AS constraint_name,
      child.relname AS child_table,
      parent.relname AS parent_table,
      child_att.attname AS child_column,
      parent_att.attname AS parent_column,
      ord.ordinality AS column_position
    FROM pg_constraint con
    JOIN pg_class child ON child.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = child.relnamespace
    JOIN pg_class parent ON parent.oid = con.confrelid
    JOIN unnest(con.conkey, con.confkey) WITH ORDINALITY AS ord(child_attnum, parent_attnum, ordinality)
      ON TRUE
    JOIN pg_attribute child_att ON child_att.attrelid = child.oid AND child_att.attnum = ord.child_attnum
    JOIN pg_attribute parent_att ON parent_att.attrelid = parent.oid AND parent_att.attnum = ord.parent_attnum
    WHERE con.contype = 'f'
      AND ns.nspname = $1
    ORDER BY child.relname, con.conname, ord.ordinality;
  `, [SCHEMA_NAME]);
  return res.rows;
}

async function countRows(client, table) {
  const res = await client.query(`SELECT COUNT(*)::bigint AS count FROM ${qualifiedTable(SCHEMA_NAME, table)};`);
  return Number(res.rows[0].count);
}

async function checkDuplicatePk(client, table, pkCols) {
  if (!pkCols || pkCols.length === 0) return { checked: false, duplicates: null };
  const pkSql = pkCols.map(quoteIdent).join(', ');
  const res = await client.query(`
    SELECT COUNT(*)::bigint AS duplicate_groups
    FROM (
      SELECT ${pkSql}
      FROM ${qualifiedTable(SCHEMA_NAME, table)}
      GROUP BY ${pkSql}
      HAVING COUNT(*) > 1
    ) d;
  `);
  return { checked: true, duplicates: Number(res.rows[0].duplicate_groups) };
}

function groupForeignKeys(rows) {
  const grouped = new Map();
  for (const fk of rows) {
    const key = `${fk.constraint_name}:${fk.child_table}:${fk.parent_table}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        constraintName: fk.constraint_name,
        childTable: fk.child_table,
        parentTable: fk.parent_table,
        childColumns: [],
        parentColumns: [],
      });
    }
    grouped.get(key).childColumns.push(fk.child_column);
    grouped.get(key).parentColumns.push(fk.parent_column);
  }
  return [...grouped.values()];
}

async function checkBrokenForeignKeys(client, fkRows) {
  const results = [];
  for (const fk of groupForeignKeys(fkRows)) {
    const join = fk.childColumns.map((c, i) => `c.${quoteIdent(c)} = p.${quoteIdent(fk.parentColumns[i])}`).join(' AND ');
    const childNotNull = fk.childColumns.map(c => `c.${quoteIdent(c)} IS NOT NULL`).join(' AND ');
    const parentMissing = fk.parentColumns.map(c => `p.${quoteIdent(c)} IS NULL`).join(' AND ');
    const res = await client.query(`
      SELECT COUNT(*)::bigint AS broken_count
      FROM ${qualifiedTable(SCHEMA_NAME, fk.childTable)} c
      LEFT JOIN ${qualifiedTable(SCHEMA_NAME, fk.parentTable)} p
        ON ${join}
      WHERE ${childNotNull}
        AND ${parentMissing};
    `);
    const brokenCount = Number(res.rows[0].broken_count);
    results.push({ ...fk, brokenCount, passed: brokenCount === 0 });
  }
  return results;
}

function stableValue(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString('hex');
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) sorted[key] = stableValue(value[key]);
    return sorted;
  }
  return value;
}

function hashRows(rows) {
  const hash = crypto.createHash('sha256');
  for (const row of rows) {
    const normalized = {};
    for (const key of Object.keys(row).sort()) normalized[key] = stableValue(row[key]);
    hash.update(JSON.stringify(normalized));
    hash.update('\n');
  }
  return hash.digest('hex');
}

async function fingerprintTable(client, table, pkCols, maxRows) {
  const rowCount = await countRows(client, table);
  if (rowCount > maxRows) {
    return { checked: false, skipped: true, reason: `row count ${rowCount} > max ${maxRows}`, rowCount, sha256: null };
  }
  const orderBy = pkCols?.length ? `ORDER BY ${pkCols.map(quoteIdent).join(', ')}` : '';
  const res = await client.query(`SELECT * FROM ${qualifiedTable(SCHEMA_NAME, table)} ${orderBy};`);
  return { checked: true, skipped: false, rowCount, sha256: hashRows(res.rows) };
}

async function collectSnapshot(label, url, args) {
  const client = new Client(buildPgConfig(url));
  await client.connect();
  try {
    const tables = await getTables(client);
    const columns = await getColumns(client, tables);
    const pks = await getPrimaryKeys(client, tables);
    const fks = await getForeignKeys(client);
    const fkIntegrity = await checkBrokenForeignKeys(client, fks);

    const tableResults = {};
    let totalRows = 0;
    for (const table of tables) {
      const rowCount = await countRows(client, table);
      totalRows += rowCount;
      const pkCols = pks.get(table) || [];
      tableResults[table] = {
        rowCount,
        columns: columns.get(table) || [],
        primaryKeyColumns: pkCols,
        duplicatePk: await checkDuplicatePk(client, table, pkCols),
        fingerprint: args.includeFingerprint ? await fingerprintTable(client, table, pkCols, args.maxFingerprintRows) : null,
      };
    }

    return {
      label,
      connection: { redacted: redact(url) },
      tables,
      totalRows,
      tableResults,
      foreignKeys: fks,
      fkIntegrity,
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

function compareColumns(prod = [], rec = []) {
  const prodMap = new Map(prod.map(c => [c.name, c]));
  const recMap = new Map(rec.map(c => [c.name, c]));
  const names = [...new Set([...prodMap.keys(), ...recMap.keys()])].sort();
  const mismatches = [];

  for (const name of names) {
    const p = prodMap.get(name);
    const r = recMap.get(name);
    if (!p || !r) {
      mismatches.push({ columnName: name, reason: p ? 'missing_in_recovery' : 'missing_in_production' });
      continue;
    }
    if (p.formattedType !== r.formattedType || p.nullable !== r.nullable) {
      mismatches.push({
        columnName: name,
        reason: 'definition_mismatch',
        production: { formattedType: p.formattedType, nullable: p.nullable },
        recovery: { formattedType: r.formattedType, nullable: r.nullable },
      });
    }
  }
  return { passed: mismatches.length === 0, mismatches };
}

function compareSnapshots(production, recovery, args) {
  const allTables = [...new Set([...production.tables, ...recovery.tables])].sort();
  const tables = [];
  let overallPass = true;

  for (const tableName of allTables) {
    const prod = production.tableResults[tableName] || null;
    const rec = recovery.tableResults[tableName] || null;
    const columns = prod && rec ? compareColumns(prod.columns, rec.columns) : { passed: false, mismatches: [] };
    const fingerprint = args.includeFingerprint && prod && rec ? {
      production: prod.fingerprint,
      recovery: rec.fingerprint,
      passed: prod.fingerprint?.checked && rec.fingerprint?.checked ? prod.fingerprint.sha256 === rec.fingerprint.sha256 : null,
    } : null;

    const result = {
      tableName,
      existsInProduction: !!prod,
      existsInRecovery: !!rec,
      rowCount: {
        production: prod?.rowCount ?? null,
        recovery: rec?.rowCount ?? null,
        passed: !!prod && !!rec && prod.rowCount === rec.rowCount,
      },
      columns,
      duplicatePk: {
        production: prod?.duplicatePk ?? null,
        recovery: rec?.duplicatePk ?? null,
        passed: !!prod && !!rec && (prod.duplicatePk?.duplicates ?? 0) === 0 && (rec.duplicatePk?.duplicates ?? 0) === 0,
      },
      fingerprint,
      passed: false,
    };

    const fingerprintPass = !args.includeFingerprint || fingerprint?.passed === true || fingerprint?.passed === null;
    result.passed = result.existsInProduction && result.existsInRecovery && result.rowCount.passed && result.columns.passed && result.duplicatePk.passed && fingerprintPass;

    if (!result.passed) overallPass = false;
    tables.push(result);
  }

  const prodBroken = production.fkIntegrity.filter(fk => !fk.passed);
  const recBroken = recovery.fkIntegrity.filter(fk => !fk.passed);
  if (prodBroken.length || recBroken.length) overallPass = false;

  return {
    overallPass,
    summary: {
      totalTablesCompared: tables.length,
      productionTables: production.tables.length,
      recoveryTables: recovery.tables.length,
      productionRows: production.totalRows,
      recoveryRows: recovery.totalRows,
      rowCountMismatches: tables.filter(t => !t.rowCount.passed).length,
      columnMismatches: tables.filter(t => !t.columns.passed).length,
      duplicatePkFailures: tables.filter(t => !t.duplicatePk.passed).length,
      productionBrokenFkCount: prodBroken.reduce((s, fk) => s + fk.brokenCount, 0),
      recoveryBrokenFkCount: recBroken.reduce((s, fk) => s + fk.brokenCount, 0),
      fingerprintEnabled: args.includeFingerprint,
      fingerprintMismatches: args.includeFingerprint ? tables.filter(t => t.fingerprint && t.fingerprint.passed === false).length : null,
    },
    tables,
    foreignKeyIntegrity: { productionBrokenFks: prodBroken, recoveryBrokenFks: recBroken },
  };
}

function renderText(report) {
  const lines = [];
  lines.push('========================================');
  lines.push('AlphaTech Integrity Verification');
  lines.push('========================================');
  lines.push(`Version       : ${report.verifyVersion}`);
  lines.push(`Checked At    : ${report.checkedAt}`);
  lines.push(`Overall       : ${report.comparison.overallPass ? 'PASS' : 'FAIL'}`);
  lines.push('');
  lines.push(`Production    : ${report.production.connection.redacted}`);
  lines.push(`Recovery      : ${report.recovery.connection.redacted}`);
  lines.push('');
  lines.push('Summary');
  for (const [key, value] of Object.entries(report.comparison.summary)) {
    lines.push(`  ${key}: ${value}`);
  }
  lines.push('');
  lines.push('Tables');
  lines.push('----------------------------------------');
  for (const item of report.comparison.tables) {
    lines.push(`${item.tableName.padEnd(34)} ${item.passed ? 'PASS' : 'FAIL'} rows ${item.rowCount.production} / ${item.rowCount.recovery}`);
    if (!item.passed) {
      if (!item.existsInProduction) lines.push('  - missing in production');
      if (!item.existsInRecovery) lines.push('  - missing in recovery');
      if (!item.rowCount.passed) lines.push('  - row count mismatch');
      if (!item.columns.passed) lines.push(`  - column mismatch: ${item.columns.mismatches.length}`);
      if (!item.duplicatePk.passed) lines.push('  - duplicate primary key failure');
      if (item.fingerprint && item.fingerprint.passed === false) lines.push('  - fingerprint mismatch');
    }
  }
  lines.push('----------------------------------------');
  lines.push(`Overall: ${report.comparison.overallPass ? 'PASS' : 'FAIL'}`);
  lines.push('========================================');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!PROD_URL) throw new Error('Missing Production DB URL. Set DATABASE_URL or DIRECT_URL in .env.');
  if (!RECOVERY_URL) throw new Error('Missing Recovery DB URL. Set RECOVERY_DATABASE_URL or RESTORE_DATABASE_URL in .env.recovery.');

  ensureDir(REPORT_DIR);
  log('============================================================');
  log(`🔎 AlphaTech Integrity Verification ${VERSION}`);
  log('============================================================');

  log('Collecting Production snapshot...');
  const production = await collectSnapshot('production', PROD_URL, args);

  log('Collecting Recovery snapshot...');
  const recovery = await collectSnapshot('recovery', RECOVERY_URL, args);

  log('Comparing snapshots...');
  const comparison = compareSnapshots(production, recovery, args);

  const checkedAt = new Date().toISOString();
  const report = {
    verifyVersion: VERSION,
    checkedAt,
    schema: SCHEMA_NAME,
    options: args,
    production: { connection: production.connection, tables: production.tables, totalRows: production.totalRows },
    recovery: { connection: recovery.connection, tables: recovery.tables, totalRows: recovery.totalRows },
    comparison,
  };

  const ts = checkedAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(REPORT_DIR, `verification-report_${ts}.json`);
  const txtPath = path.join(REPORT_DIR, `verification-report_${ts}.txt`);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(txtPath, renderText(report), 'utf8');
  fs.writeFileSync(path.join(REPORT_DIR, 'verification-report.latest.json'), JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(path.join(REPORT_DIR, 'verification-report.latest.txt'), renderText(report), 'utf8');

  log(`🧾 JSON report: ${jsonPath}`);
  log(`🧾 TXT report: ${txtPath}`);
  log(`✅ Overall: ${comparison.overallPass ? 'PASS' : 'FAIL'}`);

  if (!comparison.overallPass) process.exitCode = 2;
}

main().catch((error) => {
  log(`❌ Verification failed: ${error.stack || error.message || String(error)}`);
  process.exitCode = 1;
});
