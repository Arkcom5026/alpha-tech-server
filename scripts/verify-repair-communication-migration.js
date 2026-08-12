const { prisma } = require('../lib/prisma');

const run = async () => {
  const columns = await prisma.$queryRawUnsafe(`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='DeviceIntake' AND column_name IN ('assetDescription','deviceId') ORDER BY column_name`);
  const missingDescriptions = Number((await prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS value FROM "DeviceIntake" WHERE "assetDescription" IS NULL OR TRIM("assetDescription") = \'\''))[0]?.value || 0);
  const tables = await prisma.$queryRawUnsafe(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('CommunicationProfile','CustomerContactChannel','RepairCommunicationPreference','RepairCommunicationActivity') ORDER BY table_name`);
  const result = { columns, missingDescriptions, communicationTables: tables.map((row) => row.table_name) };
  console.log(JSON.stringify(result, null, 2));
  if (columns.length !== 2 || missingDescriptions !== 0 || tables.length !== 4) process.exitCode = 1;
};

run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
