'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const SCHEMA_NAME = process.env.CUSTOMER_BRANCH_BACKFILL_SCHEMA || 'public';
const OUTPUT_DIR =
  process.env.CUSTOMER_BRANCH_BACKFILL_OUTPUT_DIR ||
  path.join(process.cwd(), 'reports', 'customer-branch-assignment');
const RAW_CONNECTION_STRING = process.env.DIRECT_URL || process.env.DATABASE_URL;
const EXPECTED_SINGLE_BRANCH = Number(process.env.CUSTOMER_BRANCH_EXPECTED_SINGLE_BRANCH || 55);
const EXPECTED_TOTAL = Number(process.env.CUSTOMER_BRANCH_EXPECTED_TOTAL || 224);
const APPLY = String(process.env.CUSTOMER_BRANCH_BACKFILL_APPLY || '').toLowerCase() === 'true';

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
      con.conname AS constraint_name
    FROM pg_constraint con
    JOIN pg_class child ON child.oid = con.conrelid
    JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
    JOIN pg_class parent ON parent.oid = con.confrelid
    JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
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

async function loadCustomers(client) {
  const result = await client.query(
    `
    SELECT "id", "userId", "branchId", "name"
    FROM ${qualifiedTable(SCHEMA_NAME, 'CustomerProfile')}
    ORDER BY "id";
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
  }));
}

async function buildAssignmentState(client) {
  const sources = await discoverCustomerEvidenceSources(client);
  const customers = await loadCustomers(client);
  const evidenceByCustomer = new Map();

  for (const source of sources) {
    const rows = await loadEvidenceForSource(client, source);
    for (const row of rows) {
      if (!evidenceByCustomer.has(row.customerId)) evidenceByCustomer.set(row.customerId, []);
      evidenceByCustomer.get(row.customerId).push(row);
    }
  }

  const results = customers.map((customer) => {
    const evidence = evidenceByCustomer.get(Number(customer.id)) || [];
    const branchIds = [...new Set(
      evidence
        .map((item) => item.branchId)
        .filter((branchId) => Number.isInteger(branchId) && branchId > 0)
    )].sort((a, b) => a - b);
    const nullBranchEvidenceCount = evidence
      .filter((item) => item.branchId === null)
      .reduce((sum, item) => sum + item.rowCount, 0);

    let classification = 'NO_EVIDENCE';
    let proposedBranchId = null;
    const currentBranchId = customer.branchId === null ? null : Number(customer.branchId);

    if (branchIds.length === 1) {
      classification = 'SINGLE_BRANCH';
      proposedBranchId = branchIds[0];
    } else if (branchIds.length > 1) {
      classification = 'MULTI_BRANCH';
    }

    if (
      currentBranchId !== null &&
      (branchIds.length > 1 || (branchIds.length === 1 && branchIds[0] !== currentBranchId))
    ) {
      classification = 'CONFLICT';
    }

    return {
      customerProfileId: Number(customer.id),
      userId: Number(customer.userId),
      name: customer.name || null,
      currentBranchId,
      proposedBranchId,
      classification,
      branchIds,
      nullBranchEvidenceCount,
      evidence,
    };
  });

  const summary = {
    totalCustomerProfiles: results.length,
    SINGLE_BRANCH: results.filter((item) => item.classification === 'SINGLE_BRANCH').length,
    MULTI_BRANCH: results.filter((item) => item.classification === 'MULTI_BRANCH').length,
    NO_EVIDENCE: results.filter((item) => item.classification === 'NO_EVIDENCE').length,
    CONFLICT: results.filter((item) => item.classification === 'CONFLICT').length,
    alreadyAssigned: results.filter((item) => item.currentBranchId !== null).length,
    unassigned: results.filter((item) => item.currentBranchId === null).length,
  };

  return { sources, results, summary };
}

function assertPreflight(state) {
  const { summary, results } = state;
  const candidates = results.filter(
    (item) =>
      item.classification === 'SINGLE_BRANCH' &&
      item.currentBranchId === null &&
      Number.isInteger(item.proposedBranchId) &&
      item.proposedBranchId > 0
  );

  if (summary.totalCustomerProfiles !== EXPECTED_TOTAL) {
    throw new Error(
      `Preflight aborted: expected ${EXPECTED_TOTAL} CustomerProfile rows, found ${summary.totalCustomerProfiles}`
    );
  }
  if (summary.SINGLE_BRANCH !== EXPECTED_SINGLE_BRANCH) {
    throw new Error(
      `Preflight aborted: expected ${EXPECTED_SINGLE_BRANCH} SINGLE_BRANCH rows, found ${summary.SINGLE_BRANCH}`
    );
  }
  if (summary.MULTI_BRANCH !== 0 || summary.CONFLICT !== 0) {
    throw new Error(
      `Preflight aborted: MULTI_BRANCH=${summary.MULTI_BRANCH}, CONFLICT=${summary.CONFLICT}`
    );
  }
  if (summary.alreadyAssigned !== 0) {
    throw new Error(`Preflight aborted: expected 0 already assigned rows, found ${summary.alreadyAssigned}`);
  }
  if (candidates.length !== EXPECTED_SINGLE_BRANCH) {
    throw new Error(
      `Preflight aborted: expected ${EXPECTED_SINGLE_BRANCH} writable candidates, found ${candidates.length}`
    );
  }

  return candidates;
}

async function applyAssignments(client, candidates) {
  let updated = 0;
  const updates = [];

  for (const candidate of candidates) {
    const result = await client.query(
      `
      UPDATE ${qualifiedTable(SCHEMA_NAME, 'CustomerProfile')}
      SET "branchId" = $1, "updatedAt" = NOW()
      WHERE "id" = $2
        AND "branchId" IS NULL
      RETURNING "id", "branchId";
      `,
      [candidate.proposedBranchId, candidate.customerProfileId]
    );

    if (result.rowCount !== 1) {
      throw new Error(
        `Backfill aborted: CustomerProfile ${candidate.customerProfileId} updated ${result.rowCount} rows`
      );
    }

    updated += result.rowCount;
    updates.push({
      customerProfileId: candidate.customerProfileId,
      branchId: candidate.proposedBranchId,
    });
  }

  return { updated, updates };
}

function assertPostcondition(state) {
  const expectedUnassigned = EXPECTED_TOTAL - EXPECTED_SINGLE_BRANCH;
  const { summary } = state;

  if (summary.totalCustomerProfiles !== EXPECTED_TOTAL) {
    throw new Error('Post-condition aborted: total CustomerProfile count changed');
  }
  if (summary.alreadyAssigned !== EXPECTED_SINGLE_BRANCH) {
    throw new Error(
      `Post-condition aborted: expected ${EXPECTED_SINGLE_BRANCH} assigned rows, found ${summary.alreadyAssigned}`
    );
  }
  if (summary.unassigned !== expectedUnassigned) {
    throw new Error(
      `Post-condition aborted: expected ${expectedUnassigned} unassigned rows, found ${summary.unassigned}`
    );
  }
  if (summary.MULTI_BRANCH !== 0 || summary.CONFLICT !== 0) {
    throw new Error(
      `Post-condition aborted: MULTI_BRANCH=${summary.MULTI_BRANCH}, CONFLICT=${summary.CONFLICT}`
    );
  }
}

function writeReport(report) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const mode = report.applyRequested ? 'apply' : 'dry-run';
  const outputPath = path.join(
    OUTPUT_DIR,
    `customer-branch-assignment-backfill_${mode}_${timestamp}.json`
  );
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  return outputPath;
}

async function main() {
  const client = new Client(buildPgConnectionConfig(RAW_CONNECTION_STRING));
  const startedAt = new Date();
  let transactionStarted = false;

  try {
    await client.connect();
    const dbInfo = await client.query(
      `SELECT current_database() AS database_name, current_user AS database_user;`
    );

    console.log('🔌 Connected to PostgreSQL successfully.');
    console.log(`🛡️ Customer branch assignment backfill mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

    await client.query('BEGIN');
    transactionStarted = true;
    await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');

    const before = await buildAssignmentState(client);
    const candidates = assertPreflight(before);

    console.log(`✅ Preflight PASS: ${candidates.length} guarded assignments ready.`);

    let mutation = { updated: 0, updates: [] };
    let after = before;

    if (APPLY) {
      mutation = await applyAssignments(client, candidates);
      if (mutation.updated !== EXPECTED_SINGLE_BRANCH) {
        throw new Error(
          `Backfill aborted: expected ${EXPECTED_SINGLE_BRANCH} updates, found ${mutation.updated}`
        );
      }
      after = await buildAssignmentState(client);
      assertPostcondition(after);
      await client.query('COMMIT');
      transactionStarted = false;
    } else {
      await client.query('ROLLBACK');
      transactionStarted = false;
    }

    const report = {
      reportType: 'CUSTOMER_BRANCH_ASSIGNMENT_GUARDED_BACKFILL',
      createdAt: new Date().toISOString(),
      startedAt: startedAt.toISOString(),
      database: dbInfo.rows[0],
      schema: SCHEMA_NAME,
      applyRequested: APPLY,
      mutationPerformed: APPLY,
      expected: {
        totalCustomerProfiles: EXPECTED_TOTAL,
        singleBranchAssignments: EXPECTED_SINGLE_BRANCH,
      },
      beforeSummary: before.summary,
      candidateCount: candidates.length,
      candidates,
      mutation,
      afterSummary: APPLY ? after.summary : null,
      committed: APPLY,
    };

    const outputPath = writeReport(report);
    console.log(`📄 Report: ${outputPath}`);
    console.log(`👥 Total profiles: ${before.summary.totalCustomerProfiles}`);
    console.log(`🏪 Candidates: ${candidates.length}`);
    console.log(`✍️ Updated: ${mutation.updated}`);
    console.log(`💾 Committed: ${APPLY}`);
    console.log(APPLY ? '✅ Backfill completed and committed.' : '🧊 Dry-run completed; no mutation performed.');
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK').catch(() => undefined);
    }
    console.error('❌ Customer branch assignment backfill failed:', error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

main();
