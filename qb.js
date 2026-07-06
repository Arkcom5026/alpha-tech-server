// quick-backup-v6.js
// P1 Hardened Backup v6
// Mission: backup runtime data in a restore-friendly SQL file with manifest, checksum,
// verification, retention, log output, and PostgreSQL type-aware serialization and generic self-referencing FK safe restore.

require('dotenv').config();

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BACKUP_VERSION = 'P1-HARDENED-BACKUP-V6-TYPE-AWARE-GENERIC-SELF-REF';
const SCHEMA_NAME = process.env.BACKUP_SCHEMA || 'public';
const OUTPUT_DIR = process.env.BACKUP_OUTPUT_DIR || path.join(process.cwd(), 'backups');
const LOG_DIR = process.env.BACKUP_LOG_DIR || OUTPUT_DIR;
const RAW_CONNECTION_STRING = process.env.DIRECT_URL || process.env.DATABASE_URL;
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 30);
const VERIFY_AFTER_WRITE = String(process.env.BACKUP_VERIFY_AFTER_WRITE || 'true').toLowerCase() !== 'false';
const VERIFY_KEY_TABLES = String(
  process.env.BACKUP_VERIFY_KEY_TABLES || 'Product,BranchPrice,StockItem,Sale,SaleItem,SaleItemSimple,Payment,PaymentItem'
)
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);

const SKIP_TABLES = new Set(['_prisma_migrations']);

if (!RAW_CONNECTION_STRING) {
  console.error('❌ Missing database connection string. Set DIRECT_URL or DATABASE_URL in .env');
  process.exit(1);
}

function nowIso() {
  return new Date().toISOString();
}

function appendLog(message) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(path.join(LOG_DIR, 'backup.log'), `[${nowIso()}] ${message}\n`, 'utf8');
  } catch (_error) {
    // Logging must never break backup execution.
  }
}

function logInfo(message) {
  console.log(message);
  appendLog(message);
}

function logError(message, error) {
  console.error(message, error || '');
  appendLog(`${message}${error ? ` ${error.stack || error.message || String(error)}` : ''}`);
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

function quoteIdent(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function qualifiedTable(schemaName, tableName) {
  return `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;
}

function sqlStringLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function normalizeTypeName(columnMeta = {}) {
  return String(columnMeta.formatted_type || columnMeta.udt_name || columnMeta.data_type || '').toLowerCase();
}

function isJsonType(columnMeta = {}) {
  const t = normalizeTypeName(columnMeta);
  return t === 'json' || t === 'jsonb';
}

function isArrayType(columnMeta = {}) {
  const dataType = String(columnMeta.data_type || '').toUpperCase();
  const formatted = normalizeTypeName(columnMeta);
  const udt = String(columnMeta.udt_name || '');
  return dataType === 'ARRAY' || formatted.endsWith('[]') || udt.startsWith('_');
}

function isBooleanType(columnMeta = {}) {
  const t = normalizeTypeName(columnMeta);
  return t === 'boolean' || t === 'bool';
}

function isDateTimeType(columnMeta = {}) {
  const t = normalizeTypeName(columnMeta);
  return (
    t === 'date' ||
    t === 'time without time zone' ||
    t === 'time with time zone' ||
    t === 'timestamp without time zone' ||
    t === 'timestamp with time zone' ||
    t === 'timestamptz' ||
    t === 'timetz'
  );
}

function isByteaType(columnMeta = {}) {
  return normalizeTypeName(columnMeta) === 'bytea';
}

function isNumericType(columnMeta = {}) {
  const t = normalizeTypeName(columnMeta);
  return [
    'smallint',
    'integer',
    'bigint',
    'real',
    'double precision',
    'numeric',
    'decimal',
    'int2',
    'int4',
    'int8',
    'float4',
    'float8',
  ].includes(t);
}

function getArrayCastType(columnMeta = {}) {
  const formatted = String(columnMeta.formatted_type || '').trim();
  if (formatted.endsWith('[]')) return formatted;

  const udt = String(columnMeta.udt_name || '');
  if (udt.startsWith('_')) {
    const base = udt.slice(1);
    const map = {
      text: 'text[]',
      varchar: 'character varying[]',
      bpchar: 'character[]',
      int2: 'smallint[]',
      int4: 'integer[]',
      int8: 'bigint[]',
      float4: 'real[]',
      float8: 'double precision[]',
      bool: 'boolean[]',
      uuid: 'uuid[]',
      json: 'json[]',
      jsonb: 'jsonb[]',
      date: 'date[]',
      timestamp: 'timestamp without time zone[]',
      timestamptz: 'timestamp with time zone[]',
      numeric: 'numeric[]',
    };
    return map[base] || `${quoteIdent(base)}[]`;
  }

  return 'text[]';
}

function getArrayElementTypeMeta(columnMeta = {}) {
  const castType = getArrayCastType(columnMeta);
  const elementFormattedType = castType.endsWith('[]') ? castType.slice(0, -2) : 'text';
  return {
    formatted_type: elementFormattedType,
    data_type: elementFormattedType,
    udt_name: elementFormattedType,
  };
}

function sqlScalarLiteral(value, columnMeta = {}) {
  if (value === null || value === undefined) return 'NULL';

  if (isJsonType(columnMeta)) {
    return `${sqlStringLiteral(JSON.stringify(value))}::${normalizeTypeName(columnMeta)}`;
  }

  if (isByteaType(columnMeta)) {
    if (Buffer.isBuffer(value)) return `decode('${value.toString('hex')}', 'hex')`;
    return `decode('${Buffer.from(String(value), 'utf8').toString('hex')}', 'hex')`;
  }

  if (isBooleanType(columnMeta)) {
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    const normalized = String(value).toLowerCase();
    return ['true', 't', '1', 'yes', 'y'].includes(normalized) ? 'TRUE' : 'FALSE';
  }

  if (isNumericType(columnMeta)) {
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
    if (typeof value === 'bigint') return String(value);

    const normalized = String(value).trim();
    if (!normalized) return 'NULL';

    // Numeric values from pg often come back as strings.
    // Keep them unquoted only when they are clearly numeric.
    if (/^[+-]?(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized)) return normalized;

    return sqlStringLiteral(value);
  }

  if (isDateTimeType(columnMeta)) {
    if (value instanceof Date) return sqlStringLiteral(value.toISOString());
    return sqlStringLiteral(value);
  }

  if (value instanceof Date) return sqlStringLiteral(value.toISOString());
  if (Buffer.isBuffer(value)) return `decode('${value.toString('hex')}', 'hex')`;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'bigint') return String(value);

  // If an object reaches here, it is not a json/jsonb column.
  // Stringify as text to keep the backup valid instead of forcing jsonb.
  if (typeof value === 'object') return sqlStringLiteral(JSON.stringify(value));

  return sqlStringLiteral(value);
}

function sqlArrayLiteral(value, columnMeta = {}) {
  const arrayCastType = getArrayCastType(columnMeta);
  const elementMeta = getArrayElementTypeMeta(columnMeta);

  if (!Array.isArray(value)) {
    // Defensive fallback for unexpected pg parser output.
    return `${sqlStringLiteral(String(value))}::${arrayCastType}`;
  }

  if (value.length === 0) {
    return `ARRAY[]::${arrayCastType}`;
  }

  const values = value.map((item) => {
    if (item === null || item === undefined) return 'NULL';

    // Nested arrays are rare in this project; serialize defensively as JSON string.
    if (Array.isArray(item)) return sqlStringLiteral(JSON.stringify(item));

    return sqlScalarLiteral(item, elementMeta);
  });

  return `ARRAY[${values.join(', ')}]::${arrayCastType}`;
}

function sqlLiteral(value, columnMeta = {}) {
  if (value === null || value === undefined) return 'NULL';

  // Important order:
  // json/jsonb columns may legitimately contain JSON arrays, so handle JSON before PostgreSQL arrays.
  if (isJsonType(columnMeta)) {
    return `${sqlStringLiteral(JSON.stringify(value))}::${normalizeTypeName(columnMeta)}`;
  }

  if (isArrayType(columnMeta)) {
    return sqlArrayLiteral(value, columnMeta);
  }

  return sqlScalarLiteral(value, columnMeta);
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

function bytesToMb(bytes) {
  return bytes / 1024 / 1024;
}

function safeUnlink(filePath) {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

function cleanupOldBackups(outputDir, retentionDays) {
  const result = {
    enabled: Number.isFinite(retentionDays) && retentionDays > 0,
    retentionDays,
    deletedFiles: [],
    skipped: [],
  };

  if (!result.enabled) return result;
  if (!fs.existsSync(outputDir)) return result;

  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const backupFilePattern = /^alphatech_hardened_backup_v\d+_.*\.(sql|json)$/;

  for (const fileName of fs.readdirSync(outputDir)) {
    if (!backupFilePattern.test(fileName)) continue;

    const filePath = path.join(outputDir, fileName);
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.mtimeMs >= cutoffMs) continue;

    if (safeUnlink(filePath)) {
      result.deletedFiles.push(fileName);
    } else {
      result.skipped.push(fileName);
    }
  }

  return result;
}

function topoSortTables(tables, foreignKeys) {
  const tableSet = new Set(tables);
  const graph = new Map();
  const indegree = new Map();

  for (const table of tables) {
    graph.set(table, new Set());
    indegree.set(table, 0);
  }

  for (const fk of foreignKeys) {
    const child = fk.child_table;
    const parent = fk.parent_table;
    if (!tableSet.has(child) || !tableSet.has(parent) || child === parent) continue;
    if (!graph.get(parent).has(child)) {
      graph.get(parent).add(child);
      indegree.set(child, indegree.get(child) + 1);
    }
  }

  const queue = [...tables].filter((t) => indegree.get(t) === 0).sort();
  const sorted = [];

  while (queue.length > 0) {
    const table = queue.shift();
    sorted.push(table);

    for (const next of [...graph.get(table)].sort()) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
    queue.sort();
  }

  const remaining = tables.filter((t) => !sorted.includes(t)).sort();
  return { sorted: [...sorted, ...remaining], cyclicTables: remaining };
}

async function getTables(client) {
  const res = await client.query(
    `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC;
  `,
    [SCHEMA_NAME]
  );

  return res.rows.map((row) => row.table_name).filter((tableName) => !SKIP_TABLES.has(tableName));
}

async function getColumnMetadata(client, tableNames) {
  const res = await client.query(
    `
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
  `,
    [SCHEMA_NAME, tableNames]
  );

  const result = new Map();

  for (const row of res.rows) {
    if (!result.has(row.table_name)) result.set(row.table_name, new Map());
    result.get(row.table_name).set(row.column_name, {
      tableName: row.table_name,
      columnName: row.column_name,
      ordinalPosition: row.ordinal_position,
      data_type: row.data_type,
      udt_name: row.udt_name,
      formatted_type: row.formatted_type,
      is_nullable: row.is_nullable,
    });
  }

  return result;
}

async function getForeignKeys(client) {
  const res = await client.query(
    `
    SELECT
      ns.nspname AS schema_name,
      con.conname AS constraint_name,
      child.relname AS child_table,
      parent.relname AS parent_table,
      child_att.attname AS child_column,
      parent_att.attname AS parent_column,
      ord.ordinality AS column_position,
      con.condeferrable AS is_deferrable,
      con.condeferred AS initially_deferred
    FROM pg_constraint con
    JOIN pg_class child
      ON child.oid = con.conrelid
    JOIN pg_namespace ns
      ON ns.oid = child.relnamespace
    JOIN pg_class parent
      ON parent.oid = con.confrelid
    JOIN unnest(con.conkey, con.confkey) WITH ORDINALITY AS ord(child_attnum, parent_attnum, ordinality)
      ON TRUE
    JOIN pg_attribute child_att
      ON child_att.attrelid = child.oid
     AND child_att.attnum = ord.child_attnum
    JOIN pg_attribute parent_att
      ON parent_att.attrelid = parent.oid
     AND parent_att.attnum = ord.parent_attnum
    WHERE con.contype = 'f'
      AND ns.nspname = $1
    ORDER BY child.relname, con.conname, ord.ordinality;
  `,
    [SCHEMA_NAME]
  );

  return res.rows;
}

async function getSequenceMappings(client) {
  const res = await client.query(
    `
    SELECT
      seq_ns.nspname AS sequence_schema,
      seq.relname AS sequence_name,
      tab_ns.nspname AS table_schema,
      tab.relname AS table_name,
      att.attname AS column_name
    FROM pg_class seq
    JOIN pg_namespace seq_ns ON seq_ns.oid = seq.relnamespace
    JOIN pg_depend dep ON dep.objid = seq.oid
    JOIN pg_class tab ON tab.oid = dep.refobjid
    JOIN pg_namespace tab_ns ON tab_ns.oid = tab.relnamespace
    JOIN pg_attribute att ON att.attrelid = tab.oid AND att.attnum = dep.refobjsubid
    WHERE seq.relkind = 'S'
      AND dep.deptype IN ('a', 'i')
      AND tab_ns.nspname = $1
    ORDER BY tab.relname, att.attname;
  `,
    [SCHEMA_NAME]
  );

  return res.rows;
}

async function getDatabaseMetadata(client, tableNames) {
  const [versionRes, dbRes] = await Promise.all([
    client.query('SHOW server_version;'),
    client.query('SELECT current_database() AS database_name, current_user AS database_user;'),
  ]);

  let totalRows = 0;
  const rowCounts = new Map();

  for (const tableName of tableNames) {
    const countRes = await client.query(`SELECT COUNT(*)::bigint AS count FROM ${qualifiedTable(SCHEMA_NAME, tableName)};`);
    const count = Number(countRes.rows[0].count);
    rowCounts.set(tableName, count);
    totalRows += count;
  }

  return {
    postgresVersion: versionRes.rows[0].server_version,
    databaseName: dbRes.rows[0].database_name,
    databaseUser: dbRes.rows[0].database_user,
    totalTables: tableNames.length,
    totalRows,
    rowCounts,
  };
}

async function verifyBackupAgainstDatabase(client, manifest) {
  const checks = [];
  let ok = true;

  for (const tableName of manifest.restoreOrder) {
    const expected = manifest.tables[tableName]?.rowCount ?? 0;
    const res = await client.query(`SELECT COUNT(*)::bigint AS count FROM ${qualifiedTable(SCHEMA_NAME, tableName)};`);
    const actual = Number(res.rows[0].count);
    const passed = expected === actual;
    if (!passed) ok = false;
    checks.push({ tableName, expected, actual, passed });
  }

  const keyChecks = checks.filter((item) => VERIFY_KEY_TABLES.includes(item.tableName));

  return {
    ok,
    checkedAt: new Date().toISOString(),
    checkedTables: checks.length,
    keyTables: keyChecks,
    mismatches: checks.filter((item) => !item.passed),
  };
}

function columnMetaForManifest(columnMeta) {
  return {
    dataType: columnMeta.data_type,
    udtName: columnMeta.udt_name,
    formattedType: columnMeta.formatted_type,
    nullable: columnMeta.is_nullable === 'YES',
  };
}


function buildSelfReferenceFkMap(foreignKeys) {
  const map = new Map();

  for (const fk of foreignKeys) {
    if (!fk.child_table || fk.child_table !== fk.parent_table) continue;

    if (!map.has(fk.child_table)) map.set(fk.child_table, new Map());
    if (!map.get(fk.child_table).has(fk.constraint_name)) {
      map.get(fk.child_table).set(fk.constraint_name, {
        constraintName: fk.constraint_name,
        tableName: fk.child_table,
        childColumns: [],
        parentColumns: [],
        isDeferrable: !!fk.is_deferrable,
        initiallyDeferred: !!fk.initially_deferred,
      });
    }

    const item = map.get(fk.child_table).get(fk.constraint_name);
    item.childColumns.push(fk.child_column);
    item.parentColumns.push(fk.parent_column);
  }

  return map;
}

function getSelfReferenceFksForTable(selfReferenceFkMap, tableName) {
  return [...(selfReferenceFkMap.get(tableName)?.values() || [])];
}

function getDeferredSelfReferenceColumns(selfReferenceFkMap, tableName) {
  return new Set(
    getSelfReferenceFksForTable(selfReferenceFkMap, tableName)
      .flatMap((fk) => fk.childColumns)
      .filter(Boolean)
  );
}

function shouldDeferSelfReferenceColumn(selfReferenceFkMap, tableName, columnName) {
  return getDeferredSelfReferenceColumns(selfReferenceFkMap, tableName).has(columnName);
}

function buildDeferredSelfReferenceUpdates({ tableName, tableRef, dataRows, columns, columnMetaMap, selfReferenceFkMap }) {
  const statements = [];
  const deferredFks = getSelfReferenceFksForTable(selfReferenceFkMap, tableName);

  if (deferredFks.length === 0) return statements;

  const primaryKeyColumns = columns.includes('id') ? ['id'] : [];
  if (primaryKeyColumns.length === 0) {
    return statements;
  }

  for (const row of dataRows) {
    const whereSql = primaryKeyColumns
      .map((pkColumn) => {
        const pkMeta = columnMetaMap.get(pkColumn);
        return `${quoteIdent(pkColumn)} = ${sqlLiteral(row[pkColumn], pkMeta)}`;
      })
      .join(' AND ');

    const setParts = [];

    for (const fk of deferredFks) {
      for (const childColumn of fk.childColumns) {
        if (!columns.includes(childColumn)) continue;
        if (row[childColumn] === null || row[childColumn] === undefined) continue;

        const childMeta = columnMetaMap.get(childColumn);
        setParts.push(`${quoteIdent(childColumn)} = ${sqlLiteral(row[childColumn], childMeta)}`);
      }
    }

    if (setParts.length === 0) continue;

    statements.push(`UPDATE ${tableRef} SET ${setParts.join(', ')} WHERE ${whereSql};`);
  }

  return statements;
}

async function runAlphaTechBackup() {
  const startedAt = Date.now();
  const client = new Client(buildPgConnectionConfig(RAW_CONNECTION_STRING));

  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.mkdirSync(LOG_DIR, { recursive: true });

    await client.connect();
    logInfo('🔌 Connected to PostgreSQL successfully.');
    logInfo('⏳ Starting P1 Hardened Backup v6 Type-aware + generic self-reference FK safe restore...');

    const tables = await getTables(client);
    const foreignKeys = await getForeignKeys(client);
    const selfReferenceFkMap = buildSelfReferenceFkMap(foreignKeys);
    const { sorted: restoreOrder, cyclicTables } = topoSortTables(tables, foreignKeys);
    const columnMetadata = await getColumnMetadata(client, restoreOrder);
    const sequenceMappings = await getSequenceMappings(client);
    const metadata = await getDatabaseMetadata(client, restoreOrder);

    const createdAt = new Date();
    const datePart = createdAt.toISOString().slice(0, 10);
    const timestampPart = createdAt.toISOString().replace(/[:.]/g, '-');
    const fileBaseName = `alphatech_hardened_backup_v6_${datePart}_${timestampPart}`;
    const sqlFileName = `${fileBaseName}.sql`;
    const manifestFileName = `${fileBaseName}.manifest.json`;
    const sqlFilePath = path.join(OUTPUT_DIR, sqlFileName);
    const manifestFilePath = path.join(OUTPUT_DIR, manifestFileName);

    let sqlOutput = '';
    sqlOutput += `-- AlphaTech Hardened Enterprise Backup\n`;
    sqlOutput += `-- Backup Version: ${BACKUP_VERSION}\n`;
    sqlOutput += `-- Created At: ${createdAt.toISOString()}\n`;
    sqlOutput += `-- Locale Time: ${createdAt.toLocaleString('th-TH')}\n`;
    sqlOutput += `-- Database: ${metadata.databaseName}\n`;
    sqlOutput += `-- Database User: ${metadata.databaseUser}\n`;
    sqlOutput += `-- Schema: ${SCHEMA_NAME}\n`;
    sqlOutput += `-- PostgreSQL Version: ${metadata.postgresVersion}\n`;
    sqlOutput += `-- Total Tables: ${metadata.totalTables}\n`;
    sqlOutput += `-- Total Rows: ${metadata.totalRows}\n`;
    sqlOutput += `-- Restore Order: ${restoreOrder.join(' -> ')}\n`;
    if (cyclicTables.length > 0) {
      sqlOutput += `-- Warning: Possible cyclic FK tables appended at end: ${cyclicTables.join(', ')}\n`;
    }
    sqlOutput += `\n`;

    sqlOutput += `SET statement_timeout = 0;\n`;
    sqlOutput += `SET client_encoding = 'UTF8';\n`;
    sqlOutput += `SET standard_conforming_strings = on;\n`;
    sqlOutput += `SET check_function_bodies = false;\n`;
    sqlOutput += `SET client_min_messages = warning;\n\n`;
    sqlOutput += `BEGIN;\n`;
    sqlOutput += `SET CONSTRAINTS ALL DEFERRED;\n\n`;

    const tableManifest = {};

    for (const tableName of restoreOrder) {
      logInfo(`📦 Exporting table: ${tableName}`);
      const tableRef = qualifiedTable(SCHEMA_NAME, tableName);
      const columnMetaMap = columnMetadata.get(tableName) || new Map();

      const dataRes = await client.query(`SELECT * FROM ${tableRef};`);
      const rowCount = dataRes.rows.length;
      const expectedCount = metadata.rowCounts.get(tableName) || 0;

      const tableColumns = [...columnMetaMap.values()].sort((a, b) => a.ordinalPosition - b.ordinalPosition);
      const columns = rowCount > 0
        ? Object.keys(dataRes.rows[0])
        : tableColumns.map((columnMeta) => columnMeta.columnName);

      tableManifest[tableName] = {
        rowCount,
        expectedRowCount: expectedCount,
        verifiedDuringExport: rowCount === expectedCount,
        columns,
        columnTypes: Object.fromEntries(
          columns.map((columnName) => {
            const meta = columnMetaMap.get(columnName) || {
              data_type: 'unknown',
              udt_name: 'unknown',
              formatted_type: 'unknown',
              is_nullable: 'YES',
            };
            return [columnName, columnMetaForManifest(meta)];
          })
        ),
      };

      sqlOutput += `-- Table: ${tableRef} (${rowCount} rows)\n`;

      if (rowCount === 0) {
        sqlOutput += `-- Empty table.\n\n`;
        continue;
      }

      const columnSql = columns.map(quoteIdent).join(', ');

      const deferredSelfReferenceUpdates = buildDeferredSelfReferenceUpdates({
        tableName,
        tableRef,
        dataRows: dataRes.rows,
        columns,
        columnMetaMap,
        selfReferenceFkMap,
      });

      if (deferredSelfReferenceUpdates.length > 0) {
        const deferredFks = getSelfReferenceFksForTable(selfReferenceFkMap, tableName);
        tableManifest[tableName].deferredSelfReferenceUpdates = {
          count: deferredSelfReferenceUpdates.length,
          columns: [...getDeferredSelfReferenceColumns(selfReferenceFkMap, tableName)],
          constraints: deferredFks.map((fk) => ({
            constraintName: fk.constraintName,
            childColumns: fk.childColumns,
            parentColumns: fk.parentColumns,
            isDeferrable: fk.isDeferrable,
            initiallyDeferred: fk.initiallyDeferred,
          })),
          reason: 'self-referencing FK columns are inserted as NULL and restored after all rows in the table exist',
        };
      }

      for (const dataRow of dataRes.rows) {
        const values = columns
          .map((column) => {
            if (shouldDeferSelfReferenceColumn(selfReferenceFkMap, tableName, column)) return 'NULL';
            return sqlLiteral(dataRow[column], columnMetaMap.get(column));
          })
          .join(', ');
        sqlOutput += `INSERT INTO ${tableRef} (${columnSql}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`;
      }

      if (deferredSelfReferenceUpdates.length > 0) {
        sqlOutput += `\n-- Deferred self-reference recovery for ${tableRef}\n`;
        for (const updateSql of deferredSelfReferenceUpdates) {
          sqlOutput += `${updateSql}\n`;
        }
      }

      sqlOutput += `\n`;
    }

    sqlOutput += `-- Sequence Recovery\n`;
    for (const seq of sequenceMappings) {
      const tableRef = qualifiedTable(seq.table_schema, seq.table_name);
      const columnRef = quoteIdent(seq.column_name);
      const sequenceRef = `${quoteIdent(seq.sequence_schema)}.${quoteIdent(seq.sequence_name)}`;
      sqlOutput += `SELECT setval('${sequenceRef}', COALESCE((SELECT MAX(${columnRef}) FROM ${tableRef}), 1), (SELECT COALESCE(MAX(${columnRef}), 0) > 0 FROM ${tableRef}));\n`;
    }
    sqlOutput += `\nCOMMIT;\n\n`;

    sqlOutput += `-- Restore Manifest Summary\n`;
    for (const tableName of restoreOrder) {
      sqlOutput += `-- ${tableName}: ${tableManifest[tableName].rowCount} rows\n`;
    }
    sqlOutput += `-- Total Tables Exported: ${restoreOrder.length}\n`;
    sqlOutput += `-- Total Rows Exported: ${Object.values(tableManifest).reduce((sum, item) => sum + item.rowCount, 0)}\n`;

    fs.writeFileSync(sqlFilePath, sqlOutput, 'utf8');

    const durationMs = Date.now() - startedAt;
    const sqlStat = fs.statSync(sqlFilePath);
    const checksum = sha256File(sqlFilePath);
    const retention = cleanupOldBackups(OUTPUT_DIR, RETENTION_DAYS);

    const manifest = {
      backupVersion: BACKUP_VERSION,
      createdAt: createdAt.toISOString(),
      localeTime: createdAt.toLocaleString('th-TH'),
      schema: SCHEMA_NAME,
      database: {
        name: metadata.databaseName,
        user: metadata.databaseUser,
        postgresVersion: metadata.postgresVersion,
      },
      files: {
        sqlFileName,
        sqlFilePath,
        manifestFileName,
        manifestFilePath,
        fileSizeBytes: sqlStat.size,
        fileSizeMb: Number(bytesToMb(sqlStat.size).toFixed(4)),
        sha256: checksum,
      },
      summary: {
        totalTables: restoreOrder.length,
        totalRows: Object.values(tableManifest).reduce((sum, item) => sum + item.rowCount, 0),
        sequenceCount: sequenceMappings.length,
        durationMs,
        durationSeconds: Number((durationMs / 1000).toFixed(2)),
      },
      restoreOrder,
      cyclicTables,
      selfReferenceForeignKeys: Object.fromEntries(
        [...selfReferenceFkMap.entries()].map(([tableName, constraints]) => [
          tableName,
          [...constraints.values()].map((fk) => ({
            constraintName: fk.constraintName,
            childColumns: fk.childColumns,
            parentColumns: fk.parentColumns,
            isDeferrable: fk.isDeferrable,
            initiallyDeferred: fk.initiallyDeferred,
          })),
        ])
      ),
      sequences: sequenceMappings,
      keyTableCounts: Object.fromEntries(
        VERIFY_KEY_TABLES.filter((name) => tableManifest[name]).map((name) => [name, tableManifest[name].rowCount])
      ),
      tables: tableManifest,
      verification: null,
      retention,
    };

    if (VERIFY_AFTER_WRITE) {
      manifest.verification = await verifyBackupAgainstDatabase(client, manifest);
    }

    fs.writeFileSync(manifestFilePath, JSON.stringify(manifest, null, 2), 'utf8');

    logInfo('\n🎉 P1 Hardened Backup v6 Type-aware + generic self-reference FK safe restore completed successfully.');
    logInfo(`💾 Backup file: ${sqlFilePath}`);
    logInfo(`🧾 Manifest file: ${manifestFilePath}`);
    logInfo(`📊 Tables exported: ${manifest.summary.totalTables}`);
    logInfo(`📦 Rows exported: ${manifest.summary.totalRows}`);
    logInfo(`🔢 Sequences prepared: ${manifest.summary.sequenceCount}`);
    logInfo(`🔐 SHA256: ${checksum}`);
    logInfo(`📐 File size: ${manifest.files.fileSizeMb.toFixed(2)} MB`);
    logInfo(`⏱️ Duration: ${manifest.summary.durationSeconds.toFixed(2)} seconds`);

    if (manifest.verification) {
      logInfo(`✅ Verification: ${manifest.verification.ok ? 'PASS' : 'FAIL'} (${manifest.verification.checkedTables} tables checked)`);
      if (!manifest.verification.ok) {
        process.exitCode = 2;
      }
    }

    if (retention.deletedFiles.length > 0) {
      logInfo(`🧹 Retention cleanup deleted ${retention.deletedFiles.length} old backup file(s).`);
    }
  } catch (error) {
    logError('❌ Backup failed:', error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

runAlphaTechBackup();
