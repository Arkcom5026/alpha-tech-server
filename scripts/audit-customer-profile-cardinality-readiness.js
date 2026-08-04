'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const RAW_CONNECTION_STRING = process.env.DIRECT_URL || process.env.DATABASE_URL;
const OUTPUT_DIR = path.join(process.cwd(), 'reports', 'customer-branch-assignment');

if (!RAW_CONNECTION_STRING) {
  console.error('❌ Missing DIRECT_URL or DATABASE_URL');
  process.exit(1);
}

function config(connectionString) {
  const url = new URL(connectionString);
  url.searchParams.delete('sslmode');
  return {
    connectionString: url.toString(),
    ssl: String(connectionString).includes('supabase') ? { rejectUnauthorized: false } : false,
  };
}

async function main() {
  const client = new Client(config(RAW_CONNECTION_STRING));
  try {
    await client.connect();

    const db = await client.query(`
      SELECT current_database() AS database_name,
             current_user AS database_user,
             inet_server_addr()::text AS server,
             inet_server_port() AS port;
    `);

    const summaryResult = await client.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT("branchId")::int AS assigned,
        (COUNT(*) - COUNT("branchId"))::int AS unassigned,
        COUNT(DISTINCT "userId")::int AS distinct_users
      FROM "CustomerProfile";
    `);

    const duplicateAssignedPairs = await client.query(`
      SELECT "branchId", "userId", COUNT(*)::int AS count,
             ARRAY_AGG("id" ORDER BY "id") AS customer_profile_ids
      FROM "CustomerProfile"
      WHERE "branchId" IS NOT NULL
      GROUP BY "branchId", "userId"
      HAVING COUNT(*) > 1
      ORDER BY "branchId", "userId";
    `);

    const usersWithMultipleProfiles = await client.query(`
      SELECT "userId", COUNT(*)::int AS profile_count,
             ARRAY_AGG("id" ORDER BY "id") AS customer_profile_ids,
             ARRAY_AGG("branchId" ORDER BY "id") AS branch_ids
      FROM "CustomerProfile"
      GROUP BY "userId"
      HAVING COUNT(*) > 1
      ORDER BY "userId";
    `);

    const assignedByBranch = await client.query(`
      SELECT "branchId", COUNT(*)::int AS count
      FROM "CustomerProfile"
      WHERE "branchId" IS NOT NULL
      GROUP BY "branchId"
      ORDER BY "branchId";
    `);

    const nullOwnershipSample = await client.query(`
      SELECT cp."id", cp."userId", cp."name", u."loginId", u."email"
      FROM "CustomerProfile" cp
      JOIN "User" u ON u."id" = cp."userId"
      WHERE cp."branchId" IS NULL
      ORDER BY cp."id"
      LIMIT 25;
    `);

    const summary = summaryResult.rows[0];
    const pass =
      summary.total === 224 &&
      summary.assigned === 55 &&
      summary.unassigned === 169 &&
      duplicateAssignedPairs.rows.length === 0 &&
      usersWithMultipleProfiles.rows.length === 0;

    const report = {
      reportType: 'CUSTOMER_PROFILE_CARDINALITY_READINESS_AUDIT',
      createdAt: new Date().toISOString(),
      mutationPerformed: false,
      database: db.rows[0],
      expectedBaseline: { total: 224, assigned: 55, unassigned: 169 },
      summary,
      duplicateAssignedPairs: duplicateAssignedPairs.rows,
      usersWithMultipleProfiles: usersWithMultipleProfiles.rows,
      assignedByBranch: assignedByBranch.rows,
      nullOwnershipSample: nullOwnershipSample.rows,
      readiness: {
        pass,
        safeToDropGlobalUserIdUnique: pass,
        safeToAddAssignedPairUnique: duplicateAssignedPairs.rows.length === 0,
        branchIdCanBecomeRequired: summary.unassigned === 0,
      },
    };

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(OUTPUT_DIR, `customer-profile-cardinality-readiness_${timestamp}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');

    console.log('✅ CustomerProfile cardinality readiness audit completed.');
    console.log(`📄 Report: ${outputPath}`);
    console.log(`👥 Total: ${summary.total}`);
    console.log(`🏪 Assigned: ${summary.assigned}`);
    console.log(`❔ Unassigned: ${summary.unassigned}`);
    console.log(`🔁 Duplicate assigned branch/user pairs: ${duplicateAssignedPairs.rows.length}`);
    console.log(`👤 Users already having multiple profiles: ${usersWithMultipleProfiles.rows.length}`);
    console.log(`🧭 Safe to drop global userId unique: ${report.readiness.safeToDropGlobalUserIdUnique}`);
    console.log(`🔒 BranchId can become required: ${report.readiness.branchIdCanBecomeRequired}`);
    console.log('🧊 Mutation performed: false');

    if (!pass) process.exitCode = 2;
  } catch (error) {
    console.error('❌ CustomerProfile cardinality readiness audit failed:', error);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

main();
