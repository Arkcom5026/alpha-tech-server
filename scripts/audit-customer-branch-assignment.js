'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const SCHEMA_NAME = process.env.CUSTOMER_BRANCH_AUDIT_SCHEMA || 'public';
const OUTPUT_DIR =
  process.env.CUSTOMER_BRANCH_AUDIT_OUTPUT_DIR ||
  path.join(process.cwd(), 'reports', 'customer-branch-assignment');
const RAW_CONNECTION_STRING = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!RAW_CONNECTION_STRING) {
  console.error('❌ Missing DIRECT_URL or DATABASE_URL');
  process.exit(1);
}

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function qualifiedTable(schemaName, tableName) {
  return `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;
}

function buildPgConnectionConfig(connectionString) {
  const isSupabase = String(connectionString).includes('supabase');
  let normalized = connectionString;

  try {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    normalized = url.toString();
  } catch (_error) {
    normalized = connectionString;
  }

  return {
    connectionString: normalized,
    ssl: isSupabase ? { rejectUnauthorized: false } : false,
  };
}

async function discoverCustomerEvidenceSources(client) {
  const result = await client.query(
    `
    SELECT
      child.relname AS child_table,
      child_column.attname AS customer_column,
      branch_column.column_name AS branch_column,
      con.conname AS constraint_name
    FROM pg_constraint con
    JOIN pg_class child
      ON child.oid = con.conrelid
    JOIN pg_namespace child_ns
      ON child_ns.oid = child.relnamespace
    JOIN pg_class parent
      ON parent.oid = con.confrelid
    JOIN pg_namespace parent_ns
      ON parent_ns.oid = parent.relnamespace
    JOIN unnest(con.conkey, con.confkey) WITH ORDINALITY AS keys(child_attnum, parent_attnum, ordinality)
      ON TRUE
    JOIN pg_attribute child_column
      ON child_column.attrelid = child.oid
     AND child_column.attnum = keys.child_attnum
    JOIN pg_attribute parent_column
      ON parent_column.attrelid = parent.oid
     AND parent_column.attnum = keys.parent_attnum
    JOIN information_schema.columns branch_column
      ON branch_column.table_schema = child_ns.nspname
     AND branch_column.table_name = child.relname
     AND branch_column.column_name = 'branchId'
    WHERE con.contype = 'f'
      AND child_ns.nspname = $1
      AND parent_ns.nspname = $1
      AND parent.relname = 'CustomerProfile'
      AND parent_column.attname = 'id'
    ORDER BY child.relname, child_column.attname;
    `,
    [SCHEMA_NAME]
  );

  return result.rows;
}

async function loadCustomerProfiles(client) {
  const result = await client.query(
    `
    SELECT
      cp."id",
      cp."userId",
      cp."branchId",
      cp."name",
      u."loginId",
      u."email"
    FROM ${qualifiedTable(SCHEMA_NAME, 'CustomerProfile')} cp
    JOIN ${qualifiedTable(SCHEMA_NAME, 'User')} u
      ON u."id" = cp."userId"
    ORDER BY cp."id";
    `
  );

  return result.rows;
}

async function loadEvidenceForSource(client, source) {
  const tableRef = qualifiedTable(SCHEMA_NAME, source.child_table);
  const customerColumn = quoteIdent(source.customer_column);

  const result = await client.query(
    `
    SELECT
      ${customerColumn} AS "customerId",
      "branchId",
      COUNT(*)::bigint AS "rowCount"
    FROM ${tableRef}
    WHERE ${customerColumn} IS NOT NULL
    GROUP BY ${customerColumn}, "branchId"
    ORDER BY ${customerColumn}, "branchId" NULLS LAST;
    `
  );

  return result.rows.map((row) => ({
    customerId: Number(row.customerId),
    branchId: row.branchId === null ? null : Number(row.branchId),
    rowCount: Number(row.rowCount),
    table: source.child_table,
    customerColumn: source.customer_column,
    constraintName: source.constraint_name,
  }));
}

function classifyCustomer(customer, evidenceRows) {
  const nonNullBranches = [...new Set(
    evidenceRows
      .map((item) => item.branchId)
      .filter((branchId) => Number.isInteger(branchId) && branchId > 0)
  )].sort((a, b) => a - b);

  const nullBranchEvidenceCount = evidenceRows
    .filter((item) => item.branchId === null)
    .reduce((sum, item) => sum + item.rowCount, 0);

  let classification = 'NO_EVIDENCE';
  let proposedBranchId = null;
  const reasons = [];

  if (nonNullBranches.length === 1) {
    classification = 'SINGLE_BRANCH';
    proposedBranchId = nonNullBranches[0];
  } else if (nonNullBranches.length > 1) {
    classification = 'MULTI_BRANCH';
  }

  if (customer.branchId !== null) {
    const currentBranchId = Number(customer.branchId);
    if (nonNullBranches.length > 0 && !nonNullBranches.includes(currentBranchId)) {
      classification = 'CONFLICT';
      reasons.push('CURRENT_BRANCH_NOT_PRESENT_IN_BUSINESS_EVIDENCE');
    }
    if (nonNullBranches.length > 1) {
      classification = 'CONFLICT';
      reasons.push('CURRENT_PROFILE_HAS_MULTI_BRANCH_BUSINESS_EVIDENCE');
    }
  }

  if (nullBranchEvidenceCount > 0) {
    reasons.push('BUSINESS_ROWS_WITH_NULL_BRANCH');
  }

  return {
    customerProfileId: Number(customer.id),
    userId: Number(customer.userId),
    currentBranchId: customer.branchId === null ? null : Number(customer.branchId),
    proposedBranchId,
    classification,
    branchIds: nonNullBranches,
    nullBranchEvidenceCount,
    reasons,
    identity: {
      name: customer.name || null,
      loginId: customer.loginId || null,
      email: customer.email || null,
    },
    evidence: evidenceRows,
  };
}

async function main() {
  const client = new Client(buildPgConnectionConfig(RAW_CONNECTION_STRING));
  const startedAt = new Date();

  try {
    await client.connect();
    console.log('🔌 Connected to PostgreSQL successfully.');
    console.log('🔎 Running read-only CustomerProfile branch assignment audit...');

    const dbInfo = await client.query(
      `SELECT current_database() AS database_name, current_user AS database_user;`
    );

    const sources = await discoverCustomerEvidenceSources(client);
    const customers = await loadCustomerProfiles(client);
    const evidenceByCustomer = new Map();

    for (const source of sources) {
      console.log(
        `📚 Reading ${source.child_table}.${source.customer_column} -> CustomerProfile.id`
      );
      const rows = await loadEvidenceForSource(client, source);
      for (const row of rows) {
        if (!evidenceByCustomer.has(row.customerId)) {
          evidenceByCustomer.set(row.customerId, []);
        }
        evidenceByCustomer.get(row.customerId).push(row);
      }
    }

    const results = customers.map((customer) =>
      classifyCustomer(customer, evidenceByCustomer.get(Number(customer.id)) || [])
    );

    const summary = {
      totalCustomerProfiles: results.length,
      SINGLE_BRANCH: results.filter((item) => item.classification === 'SINGLE_BRANCH').length,
      MULTI_BRANCH: results.filter((item) => item.classification === 'MULTI_BRANCH').length,
      NO_EVIDENCE: results.filter((item) => item.classification === 'NO_EVIDENCE').length,
      CONFLICT: results.filter((item) => item.classification === 'CONFLICT').length,
      alreadyAssigned: results.filter((item) => item.currentBranchId !== null).length,
      unassigned: results.filter((item) => item.currentBranchId === null).length,
      withNullBranchBusinessRows: results.filter((item) => item.nullBranchEvidenceCount > 0).length,
    };

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(
      OUTPUT_DIR,
      `customer-branch-assignment-audit_${timestamp}.json`
    );

    const report = {
      reportType: 'CUSTOMER_BRANCH_ASSIGNMENT_READ_ONLY_AUDIT',
      createdAt: new Date().toISOString(),
      startedAt: startedAt.toISOString(),
      database: dbInfo.rows[0],
      schema: SCHEMA_NAME,
      mutationPerformed: false,
      evidenceSources: sources,
      summary,
      results,
    };

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');

    console.log('\n✅ Customer branch assignment audit completed.');
    console.log(`📄 Report: ${outputPath}`);
    console.log(`👥 Customer profiles: ${summary.totalCustomerProfiles}`);
    console.log(`🏪 SINGLE_BRANCH: ${summary.SINGLE_BRANCH}`);
    console.log(`🏬 MULTI_BRANCH: ${summary.MULTI_BRANCH}`);
    console.log(`❔ NO_EVIDENCE: ${summary.NO_EVIDENCE}`);
    console.log(`⚠️ CONFLICT: ${summary.CONFLICT}`);
    console.log(`🧊 Mutation performed: ${report.mutationPerformed}`);
  } catch (error) {
    console.error('❌ Customer branch assignment audit failed:', error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

main();
