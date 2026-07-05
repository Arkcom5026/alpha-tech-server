// quick-backup-v2.js
// P1 Hardened Backup v2
// Mission: backup runtime data in a restore-friendly SQL file with metadata, transaction, dependency order, and sequence reset.

require('dotenv').config();

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const BACKUP_VERSION = 'P1-HARDENED-BACKUP-V2';
const SCHEMA_NAME = process.env.BACKUP_SCHEMA || 'public';
const OUTPUT_DIR = process.env.BACKUP_OUTPUT_DIR || process.cwd();
const RAW_CONNECTION_STRING = process.env.DIRECT_URL || process.env.DATABASE_URL;

function buildPgConnectionConfig(connectionString) {
  const isSupabase = String(connectionString || '').includes('supabase');

  // pg-connection-string can turn sslmode=require into a strict TLS verify path.
  // For this local backup tool, remove sslmode from the URL and set ssl explicitly.
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
    ssl: isSupabase
      ? { rejectUnauthorized: false }
      : false,
  };
}

const CONNECTION_STRING = RAW_CONNECTION_STRING;

const SKIP_TABLES = new Set([
  '_prisma_migrations',
]);

if (!CONNECTION_STRING) {
  console.error('❌ Missing database connection string. Set DIRECT_URL or DATABASE_URL in .env');
  process.exit(1);
}

function quoteIdent(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function qualifiedTable(schemaName, tableName) {
  return `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'NULL';
    return String(value);
  }
  if (typeof value === 'bigint') return String(value);
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "''")}'`;
  if (Buffer.isBuffer(value)) return `decode('${value.toString('hex')}', 'hex')`;
  if (Array.isArray(value)) return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

function topoSortTables(tables, foreignKeys) {
  const tableSet = new Set(tables);
  const graph = new Map();
  const indegree = new Map();

  for (const table of tables) {
    graph.set(table, new Set());
    indegree.set(table, 0);
  }

  // FK means child depends on parent. Restore parent first: parent -> child.
  for (const fk of foreignKeys) {
    const child = fk.child_table;
    const parent = fk.parent_table;
    if (!tableSet.has(child) || !tableSet.has(parent) || child === parent) continue;
    if (!graph.get(parent).has(child)) {
      graph.get(parent).add(child);
      indegree.set(child, indegree.get(child) + 1);
    }
  }

  const queue = [...tables].filter(t => indegree.get(t) === 0).sort();
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

  // Cycles are possible. Append remaining tables alphabetically and rely on deferred constraints where possible.
  const remaining = tables.filter(t => !sorted.includes(t)).sort();
  return { sorted: [...sorted, ...remaining], cyclicTables: remaining };
}

async function getTables(client) {
  const res = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC;
  `, [SCHEMA_NAME]);

  return res.rows
    .map(row => row.table_name)
    .filter(tableName => !SKIP_TABLES.has(tableName));
}

async function getForeignKeys(client) {
  const res = await client.query(`
    SELECT
      tc.table_name AS child_table,
      ccu.table_name AS parent_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = $1;
  `, [SCHEMA_NAME]);

  return res.rows;
}

async function getSequenceMappings(client) {
  const res = await client.query(`
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
  `, [SCHEMA_NAME]);

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

async function runAlphaTechBackup() {
  const startedAt = Date.now();
  const client = new Client(buildPgConnectionConfig(CONNECTION_STRING));

  try {
    await client.connect();
    console.log('🔌 Connected to PostgreSQL successfully.');
    console.log('⏳ Starting P1 Hardened Backup v2...');

    const tables = await getTables(client);
    const foreignKeys = await getForeignKeys(client);
    const { sorted: restoreOrder, cyclicTables } = topoSortTables(tables, foreignKeys);
    const sequenceMappings = await getSequenceMappings(client);
    const metadata = await getDatabaseMetadata(client, restoreOrder);

    const createdAt = new Date();
    const datePart = createdAt.toISOString().slice(0, 10);
    const timestampPart = createdAt.toISOString().replace(/[:.]/g, '-');
    const fileName = `alphatech_hardened_backup_v2_${datePart}_${timestampPart}.sql`;
    const filePath = path.join(OUTPUT_DIR, fileName);

    let sqlOutput = '';
    sqlOutput += `-- 🛡️ AlphaTech Hardened Enterprise Backup\n`;
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

    const manifest = [];

    for (const tableName of restoreOrder) {
      console.log(`📦 Exporting table: ${tableName}`);
      const tableRef = qualifiedTable(SCHEMA_NAME, tableName);
      const dataRes = await client.query(`SELECT * FROM ${tableRef};`);
      const rowCount = dataRes.rows.length;
      manifest.push({ tableName, rowCount });

      sqlOutput += `-- 📋 Table: ${tableRef} (${rowCount} rows)\n`;

      if (rowCount === 0) {
        sqlOutput += `-- Empty table.\n\n`;
        continue;
      }

      const columns = Object.keys(dataRes.rows[0]);
      const columnSql = columns.map(quoteIdent).join(', ');

      for (const dataRow of dataRes.rows) {
        const values = columns.map(column => sqlLiteral(dataRow[column])).join(', ');
        sqlOutput += `INSERT INTO ${tableRef} (${columnSql}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`;
      }
      sqlOutput += `\n`;
    }

    sqlOutput += `-- 🔢 Sequence Recovery\n`;
    for (const seq of sequenceMappings) {
      const tableRef = qualifiedTable(seq.table_schema, seq.table_name);
      const columnRef = quoteIdent(seq.column_name);
      const sequenceRef = `${quoteIdent(seq.sequence_schema)}.${quoteIdent(seq.sequence_name)}`;
      sqlOutput += `SELECT setval('${sequenceRef}', COALESCE((SELECT MAX(${columnRef}) FROM ${tableRef}), 1), (SELECT COALESCE(MAX(${columnRef}), 0) > 0 FROM ${tableRef}));\n`;
    }
    sqlOutput += `\n`;

    sqlOutput += `COMMIT;\n\n`;

    sqlOutput += `-- ✅ Restore Manifest\n`;
    for (const item of manifest) {
      sqlOutput += `-- ${item.tableName}: ${item.rowCount} rows\n`;
    }
    sqlOutput += `-- Total Tables Exported: ${manifest.length}\n`;
    sqlOutput += `-- Total Rows Exported: ${manifest.reduce((sum, item) => sum + item.rowCount, 0)}\n`;

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(filePath, sqlOutput, 'utf8');

    const durationMs = Date.now() - startedAt;
    const fileSizeMb = fs.statSync(filePath).size / 1024 / 1024;

    console.log('\n🎉 P1 Hardened Backup v2 completed successfully.');
    console.log(`💾 Backup file: ${filePath}`);
    console.log(`📊 Tables exported: ${manifest.length}`);
    console.log(`📦 Rows exported: ${manifest.reduce((sum, item) => sum + item.rowCount, 0)}`);
    console.log(`🔢 Sequences prepared: ${sequenceMappings.length}`);
    console.log(`📐 File size: ${fileSizeMb.toFixed(2)} MB`);
    console.log(`⏱️ Duration: ${(durationMs / 1000).toFixed(2)} seconds`);
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

runAlphaTechBackup();
