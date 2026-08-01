#!/usr/bin/env node

const prismaModule = require('../../lib/prisma');
const prisma = prismaModule?.prisma || prismaModule;
const {
  buildSimpleStockBackfillManifest,
} = require('../../src/modules/inventory/recovery/simple-stock-backfill/manifest/simpleStockBackfillManifest');

const readBranchId = () => {
  const raw = process.argv.find((arg) => arg.startsWith('--branch-id='));
  const branchId = Number.parseInt(String(raw || '').split('=')[1], 10);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    const error = new Error(
      'Usage: node scripts/inventory-recovery/preview-simple-stock-backfill-manifest.js --branch-id=<positive integer>'
    );
    error.code = 'INVENTORY_BRANCH_SCOPE_REQUIRED';
    throw error;
  }
  return branchId;
};

const loadBranchSnapshot = async (branchId) => {
  const [balances, lots, movements] = await Promise.all([
    prisma.stockBalance.findMany({
      where: { branchId },
      select: {
        id: true,
        branchId: true,
        productId: true,
        quantity: true,
        reserved: true,
        avgCost: true,
        lastReceivedCost: true,
      },
      orderBy: [{ productId: 'asc' }, { id: 'asc' }],
    }),
    prisma.simpleLot.findMany({
      where: { branchId },
      select: {
        id: true,
        branchId: true,
        productId: true,
      },
      orderBy: [{ productId: 'asc' }, { id: 'asc' }],
    }),
    prisma.stockMovement.findMany({
      where: { branchId },
      select: {
        id: true,
        branchId: true,
        productId: true,
        simpleLotId: true,
      },
      orderBy: [{ productId: 'asc' }, { id: 'asc' }],
    }),
  ]);

  return { balances, lots, movements };
};

const main = async () => {
  const branchId = readBranchId();
  const snapshot = await loadBranchSnapshot(branchId);
  const manifest = buildSimpleStockBackfillManifest({
    branchId,
    ...snapshot,
  });

  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
};

main()
  .catch((error) => {
    console.error('[simple-stock-backfill-runtime-preview] FAIL', {
      code: error?.code || 'SIMPLE_STOCK_BACKFILL_PREVIEW_FAILED',
      message: error?.message || String(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (typeof prisma?.$disconnect === 'function') {
      await prisma.$disconnect();
    }
  });
