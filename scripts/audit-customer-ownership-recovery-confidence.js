'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const SCHEMA_NAME = process.env.CUSTOMER_OWNERSHIP_AUDIT_SCHEMA || 'public';
const OUTPUT_DIR =
  process.env.CUSTOMER_OWNERSHIP_AUDIT_OUTPUT_DIR ||
  path.join(process.cwd(), 'reports', 'customer-ownership-recovery');
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

async function loadUnassignedCustomers(client) {
  const result = await client.query(`
    SELECT
      cp."id",
      cp."userId",
      cp."createdAt",
      cp."name",
      u."loginId",
      u."email"
    FROM ${qualifiedTable(SCHEMA_NAME, 'CustomerProfile')} cp
    JOIN ${qualifiedTable(SCHEMA_NAME, 'User')} u
      ON u."id" = cp."userId"
    WHERE cp."branchId" IS NULL
    ORDER BY cp."id";
  `);

  return result.rows;
}

async function discoverDirectSources(client) {
  const result = await client.query(
    `
    SELECT
      child.relname AS child_table,
      customer_column.attname AS customer_column,
      con.conname AS customer_constraint
    FROM pg_constraint con
    JOIN pg_class child ON child.oid = con.conrelid
    JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
    JOIN pg_class parent ON parent.oid = con.confrelid
    JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
    JOIN unnest(con.conkey, con.confkey) WITH ORDINALITY
      AS keys(child_attnum, parent_attnum, ordinality) ON TRUE
    JOIN pg_attribute customer_column
      ON customer_column.attrelid = child.oid
     AND customer_column.attnum = keys.child_attnum
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
    ORDER BY child.relname, customer_column.attname;
    `,
    [SCHEMA_NAME]
  );

  return result.rows;
}

async function discoverCreatorSources(client) {
  const result = await client.query(
    `
    WITH customer_fk AS (
      SELECT
        child.oid AS child_oid,
        child.relname AS child_table,
        child_ns.nspname AS child_schema,
        customer_column.attname AS customer_column
      FROM pg_constraint con
      JOIN pg_class child ON child.oid = con.conrelid
      JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
      JOIN pg_class parent ON parent.oid = con.confrelid
      JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
      JOIN unnest(con.conkey, con.confkey) WITH ORDINALITY
        AS keys(child_attnum, parent_attnum, ordinality) ON TRUE
      JOIN pg_attribute customer_column
        ON customer_column.attrelid = child.oid
       AND customer_column.attnum = keys.child_attnum
      JOIN pg_attribute parent_column
        ON parent_column.attrelid = parent.oid
       AND parent_column.attnum = keys.parent_attnum
      WHERE con.contype = 'f'
        AND child_ns.nspname = $1
        AND parent_ns.nspname = $1
        AND parent.relname = 'CustomerProfile'
        AND parent_column.attname = 'id'
    ),
    employee_fk AS (
      SELECT
        child.oid AS child_oid,
        employee_column.attname AS employee_column,
        con.conname AS employee_constraint
      FROM pg_constraint con
      JOIN pg_class child ON child.oid = con.conrelid
      JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
      JOIN pg_class parent ON parent.oid = con.confrelid
      JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
      JOIN unnest(con.conkey, con.confkey) WITH ORDINALITY
        AS keys(child_attnum, parent_attnum, ordinality) ON TRUE
      JOIN pg_attribute employee_column
        ON employee_column.attrelid = child.oid
       AND employee_column.attnum = keys.child_attnum
      JOIN pg_attribute parent_column
        ON parent_column.attrelid = parent.oid
       AND parent_column.attnum = keys.parent_attnum
      WHERE con.contype = 'f'
        AND child_ns.nspname = $1
        AND parent_ns.nspname = $1
        AND parent.relname = 'EmployeeProfile'
        AND parent_column.attname = 'id'
    )
    SELECT
      customer_fk.child_table,
      customer_fk.customer_column,
      employee_fk.employee_column,
      employee_fk.employee_constraint,
      CASE WHEN branch_column.column_name IS NULL THEN FALSE ELSE TRUE END AS has_branch_column
    FROM customer_fk
    JOIN employee_fk ON employee_fk.child_oid = customer_fk.child_oid
    LEFT JOIN information_schema.columns branch_column
      ON branch_column.table_schema = customer_fk.child_schema
     AND branch_column.table_name = customer_fk.child_table
     AND branch_column.column_name = 'branchId'
    ORDER BY customer_fk.child_table, employee_fk.employee_column;
    `,
    [SCHEMA_NAME]
  );

  return result.rows;
}

async function loadDirectEvidence(client, source) {
  const result = await client.query(`
    SELECT
      ${quoteIdent(source.customer_column)} AS "customerId",
      "branchId",
      COUNT(*)::bigint AS "rowCount"
    FROM ${qualifiedTable(SCHEMA_NAME, source.child_table)}
    WHERE ${quoteIdent(source.customer_column)} IS NOT NULL
      AND "branchId" IS NOT NULL
    GROUP BY ${quoteIdent(source.customer_column)}, "branchId";
  `);

  return result.rows.map((row) => ({
    type: 'DIRECT_BRANCH',
    customerId: Number(row.customerId),
    branchId: Number(row.branchId),
    rowCount: Number(row.rowCount),
    table: source.child_table,
    customerColumn: source.customer_column,
  }));
}

async function loadCreatorEvidence(client, source) {
  const tableRef = qualifiedTable(SCHEMA_NAME, source.child_table);
  const customerColumn = quoteIdent(source.customer_column);
  const employeeColumn = quoteIdent(source.employee_column);
  const directBranchSelect = source.has_branch_column ? 'business."branchId"' : 'NULL';

  const result = await client.query(`
    SELECT
      business.${customerColumn} AS "customerId",
      employee."branchId" AS "employeeBranchId",
      ${directBranchSelect} AS "businessBranchId",
      COUNT(*)::bigint AS "rowCount"
    FROM ${tableRef} business
    JOIN ${qualifiedTable(SCHEMA_NAME, 'EmployeeProfile')} employee
      ON employee."id" = business.${employeeColumn}
    WHERE business.${customerColumn} IS NOT NULL
      AND business.${employeeColumn} IS NOT NULL
      AND employee."branchId" IS NOT NULL
    GROUP BY
      business.${customerColumn},
      employee."branchId"
      ${source.has_branch_column ? ', business."branchId"' : ''};
  `);

  return result.rows.map((row) => ({
    type: 'CREATOR_EMPLOYEE_BRANCH',
    customerId: Number(row.customerId),
    branchId: Number(row.employeeBranchId),
    businessBranchId:
      row.businessBranchId === null ? null : Number(row.businessBranchId),
    rowCount: Number(row.rowCount),
    table: source.child_table,
    customerColumn: source.customer_column,
    employeeColumn: source.employee_column,
  }));
}

function groupByCustomer(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.customerId)) map.set(row.customerId, []);
    map.get(row.customerId).push(row);
  }
  return map;
}

function uniqueBranches(rows) {
  return [...new Set(
    rows
      .map((row) => row.branchId)
      .filter((value) => Number.isInteger(value) && value > 0)
  )].sort((a, b) => a - b);
}

function classify(customer, directRows, creatorRows) {
  const directBranches = uniqueBranches(directRows);
  const creatorBranches = uniqueBranches(creatorRows);
  const creatorRowCount = creatorRows.reduce((sum, row) => sum + row.rowCount, 0);
  const creatorSourceCount = new Set(
    creatorRows.map((row) => `${row.table}.${row.employeeColumn}`)
  ).size;
  const creatorDirectConflicts = creatorRows.filter(
    (row) => row.businessBranchId !== null && row.businessBranchId !== row.branchId
  );

  let status = 'NO_RECOVERABLE_EVIDENCE';
  let proposedBranchId = null;
  let confidenceScore = 0;
  const reasons = [];

  if (directBranches.length > 1) {
    status = 'CONFLICT';
    reasons.push('MULTIPLE_DIRECT_BRANCHES');
  } else if (directBranches.length === 1) {
    const directBranchId = directBranches[0];
    if (creatorBranches.length > 0 && creatorBranches.some((id) => id !== directBranchId)) {
      status = 'CONFLICT';
      reasons.push('DIRECT_AND_CREATOR_BRANCH_DISAGREE');
    } else if (creatorDirectConflicts.length > 0) {
      status = 'CONFLICT';
      reasons.push('BUSINESS_AND_CREATOR_BRANCH_DISAGREE');
    } else {
      status = 'AUTO_CONFIRM';
      proposedBranchId = directBranchId;
      confidenceScore = 100;
      reasons.push('DIRECT_SINGLE_BRANCH_BUSINESS_EVIDENCE');
    }
  } else if (
    creatorBranches.length === 1 &&
    creatorDirectConflicts.length === 0 &&
    creatorRowCount >= 2
  ) {
    status = 'AUTO_CONFIRM';
    proposedBranchId = creatorBranches[0];
    confidenceScore = creatorSourceCount >= 2 ? 100 : 98;
    reasons.push(
      creatorSourceCount >= 2
        ? 'CREATOR_BRANCH_CORROBORATED_ACROSS_MULTIPLE_SOURCES'
        : 'CREATOR_BRANCH_REPEATED_WITHIN_SINGLE_SOURCE'
    );
  } else if (creatorBranches.length > 1) {
    status = 'CONFLICT';
    reasons.push('MULTIPLE_CREATOR_BRANCHES');
  } else if (creatorBranches.length === 1) {
    status = 'REVIEW_REQUIRED';
    proposedBranchId = creatorBranches[0];
    confidenceScore = 80;
    reasons.push('SINGLE_CREATOR_EVIDENCE_ONLY');
  }

  return {
    customerProfileId: Number(customer.id),
    userId: Number(customer.userId),
    identity: {
      name: customer.name || null,
      loginId: customer.loginId || null,
      email: customer.email || null,
    },
    createdAt: customer.createdAt,
    status,
    proposedBranchId,
    confidenceScore,
    reasons,
    metrics: {
      directEvidenceRows: directRows.reduce((sum, row) => sum + row.rowCount, 0),
      directSourceCount: new Set(directRows.map((row) => row.table)).size,
      creatorEvidenceRows: creatorRowCount,
      creatorSourceCount,
    },
    directEvidence: directRows,
    creatorEvidence: creatorRows,
  };
}

async function main() {
  const client = new Client(buildPgConnectionConfig(RAW_CONNECTION_STRING));
  const startedAt = new Date();

  try {
    await client.connect();
    console.log('🔌 Connected to PostgreSQL successfully.');
    console.log('🔎 Running read-only high-confidence ownership recovery audit...');

    const customers = await loadUnassignedCustomers(client);
    const directSources = await discoverDirectSources(client);
    const creatorSources = await discoverCreatorSources(client);

    const directEvidence = [];
    for (const source of directSources) {
      console.log(`📚 Direct evidence: ${source.child_table}.${source.customer_column}`);
      directEvidence.push(...await loadDirectEvidence(client, source));
    }

    const creatorEvidence = [];
    for (const source of creatorSources) {
      console.log(
        `👤 Creator evidence: ${source.child_table}.${source.employee_column} -> EmployeeProfile.branchId`
      );
      creatorEvidence.push(...await loadCreatorEvidence(client, source));
    }

    const directByCustomer = groupByCustomer(directEvidence);
    const creatorByCustomer = groupByCustomer(creatorEvidence);
    const results = customers.map((customer) => classify(
      customer,
      directByCustomer.get(Number(customer.id)) || [],
      creatorByCustomer.get(Number(customer.id)) || []
    ));

    const summary = {
      unassignedCustomerProfiles: customers.length,
      AUTO_CONFIRM: results.filter((item) => item.status === 'AUTO_CONFIRM').length,
      REVIEW_REQUIRED: results.filter((item) => item.status === 'REVIEW_REQUIRED').length,
      NO_RECOVERABLE_EVIDENCE: results.filter(
        (item) => item.status === 'NO_RECOVERABLE_EVIDENCE'
      ).length,
      CONFLICT: results.filter((item) => item.status === 'CONFLICT').length,
      mutationPerformed: false,
    };

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(
      OUTPUT_DIR,
      `customer-ownership-recovery-confidence_${timestamp}.json`
    );

    const report = {
      reportType: 'CUSTOMER_OWNERSHIP_RECOVERY_CONFIDENCE_READ_ONLY_AUDIT',
      createdAt: new Date().toISOString(),
      startedAt: startedAt.toISOString(),
      schema: SCHEMA_NAME,
      mutationPerformed: false,
      policy: {
        autoConfirmDirectSingleBranch: true,
        autoConfirmCreatorMinimumRows: 2,
        autoConfirmRequiresSingleCreatorBranch: true,
        autoConfirmRejectsAnyConflict: true,
      },
      evidenceSources: {
        direct: directSources,
        creator: creatorSources,
      },
      summary,
      results,
    };

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');

    console.log('\n✅ Customer ownership recovery confidence audit completed.');
    console.log(`📄 Report: ${outputPath}`);
    console.log(`❔ Unassigned profiles: ${summary.unassignedCustomerProfiles}`);
    console.log(`✅ AUTO_CONFIRM: ${summary.AUTO_CONFIRM}`);
    console.log(`🧑 REVIEW_REQUIRED: ${summary.REVIEW_REQUIRED}`);
    console.log(`🕳️ NO_RECOVERABLE_EVIDENCE: ${summary.NO_RECOVERABLE_EVIDENCE}`);
    console.log(`⚠️ CONFLICT: ${summary.CONFLICT}`);
    console.log(`🧊 Mutation performed: ${summary.mutationPerformed}`);
  } catch (error) {
    console.error('❌ Customer ownership recovery confidence audit failed:', error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

main();
