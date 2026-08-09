'use strict';

const { PrismaClient } = require('@prisma/client');
const filingService = require('../src/modules/tax/outputDocuments/filing/salesTaxFilingService');

const prisma = new PrismaClient();

const run = async () => {
  const duplicatePeriods = await prisma.$queryRawUnsafe(
    'SELECT "branchId", "year", "month", COUNT(*)::int AS count FROM "SalesTaxFilingBatch" GROUP BY 1,2,3 HAVING COUNT(*) > 1',
  );
  const existingItems = await prisma.$queryRawUnsafe(
    'SELECT COUNT(*)::int AS count FROM "SalesTaxFilingItem"',
  );
  const columnTypes = await prisma.$queryRawUnsafe(
    `SELECT "table_name", "column_name", "data_type", "udt_name" FROM information_schema.columns WHERE "table_name" IN ('SalesTaxFilingBatch', 'SalesTaxFilingItem') ORDER BY 1, 2`,
  );
  console.log(JSON.stringify({ duplicatePeriods, existingItems, columnTypes }));
  const runtimeRead = await filingService.listSalesTaxFilings({ branchId: 2 });
  console.log(JSON.stringify({ duplicatePeriods, existingItems, runtimeBatchCount: runtimeRead.batches.length }));
  if (duplicatePeriods.length) process.exitCode = 2;
};

run().finally(() => prisma.$disconnect());
