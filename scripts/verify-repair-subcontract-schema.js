/* eslint-env node */

const prisma = require('../src/database/prisma/client');

const REQUIRED_CONSTRAINTS = new Set([
  'RepairSubcontract_pkey',
  'RepairSubcontract_status_check',
  'RepairSubcontract_customerEstimateAmount_check',
  'RepairSubcontract_providerQuotedAmount_check',
  'RepairSubcontract_actualExternalCost_check',
  'RepairSubcontract_branchId_fkey',
  'RepairSubcontract_repairJobId_fkey',
  'RepairSubcontract_sentByEmployeeId_fkey',
  'RepairSubcontract_returnedByEmployeeId_fkey',
]);

const REQUIRED_INDEXES = new Set([
  'RepairSubcontract_branchId_status_sentAt_idx',
  'RepairSubcontract_repairJobId_sentAt_idx',
  'RepairSubcontract_repairJobId_status_idx',
  'RepairSubcontract_sentByEmployeeId_idx',
  'RepairSubcontract_returnedByEmployeeId_idx',
  'RepairSubcontract_one_active_per_job_key',
]);

function assertContains(actualNames, requiredNames, label) {
  const missing = [...requiredNames].filter((name) => !actualNames.has(name));
  if (missing.length) {
    throw new Error(`${label} missing: ${missing.join(', ')}`);
  }
}

async function main() {
  const table = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'RepairSubcontract'
  `);

  if (table.length !== 1) {
    throw new Error('RepairSubcontract table not found in public schema');
  }

  const constraints = await prisma.$queryRawUnsafe(`
    SELECT conname, contype
    FROM pg_constraint
    WHERE conrelid = '"RepairSubcontract"'::regclass
    ORDER BY conname
  `);

  const indexes = await prisma.$queryRawUnsafe(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'RepairSubcontract'
    ORDER BY indexname
  `);

  assertContains(
    new Set(constraints.map((row) => row.conname)),
    REQUIRED_CONSTRAINTS,
    'RepairSubcontract constraints'
  );
  assertContains(
    new Set(indexes.map((row) => row.indexname)),
    REQUIRED_INDEXES,
    'RepairSubcontract indexes'
  );

  const activeUnique = indexes.find(
    (row) => row.indexname === 'RepairSubcontract_one_active_per_job_key'
  );
  if (!/UNIQUE INDEX/i.test(activeUnique?.indexdef || '') ||
      !/WHERE .*status.*SENT.*RETURN_REQUESTED/i.test(activeUnique?.indexdef || '')) {
    throw new Error('RepairSubcontract active-custody unique index is not partial/unique as required');
  }

  console.log('REPAIR SUBCONTRACT SCHEMA VERIFICATION: PASS');
  console.log(`constraints=${constraints.length} indexes=${indexes.length}`);
}

main()
  .catch((error) => {
    console.error('REPAIR SUBCONTRACT SCHEMA VERIFICATION: FAIL');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
