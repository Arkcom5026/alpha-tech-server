const { prisma } = require('../lib/prisma');

const scalar = async (sql) => Number((await prisma.$queryRawUnsafe(sql))[0]?.value || 0);

const run = async () => {
  const deviceIntakeRows = await scalar('SELECT COUNT(*)::int AS value FROM "DeviceIntake"');
  const fallbackRows = await scalar(`SELECT COUNT(*)::int AS value FROM "DeviceIntake" intake
    WHERE NOT EXISTS (SELECT 1 FROM "DeviceIntakeSnapshot" snapshot WHERE snapshot."deviceIntakeId" = intake."id" AND NULLIF(TRIM(CONCAT_WS(' ', snapshot."brand", snapshot."model")), '') IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM "RepairJob" job WHERE job."id" = intake."repairJobId" AND NULLIF(TRIM(job."deviceModel"), '') IS NOT NULL)`);
  const incomplete = await prisma.$queryRawUnsafe(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL ORDER BY started_at`);
  const rolledBack = await prisma.$queryRawUnsafe(`SELECT migration_name FROM "_prisma_migrations" WHERE rolled_back_at IS NOT NULL ORDER BY started_at`);
  console.log(JSON.stringify({ safeToBackfill: incomplete.length === 0, deviceIntakeRows, rowsUsingNeutralFallback: fallbackRows, incompleteMigrationRecords: incomplete.map((row) => row.migration_name), historicalRolledBackRecords: rolledBack.map((row) => row.migration_name) }, null, 2));
  if (incomplete.length) process.exitCode = 1;
};

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
