#!/usr/bin/env node

const prismaModule = require('../../lib/prisma');
const prisma = prismaModule?.prisma || prismaModule;
const {
  validateSimpleStockBackfillApprovalDryRun,
} = require('../../src/modules/inventory/recovery/simple-stock-backfill/approval/validateSimpleStockBackfillApprovalDryRun');
const {
  buildSimpleStockBackfillExecutionPlan,
} = require('../../src/modules/inventory/recovery/simple-stock-backfill/execution-plan/buildSimpleStockBackfillExecutionPlan');

const readArg = (name) => {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  return raw ? raw.slice(prefix.length).trim() : '';
};

const readBranchId = () => {
  const branchId = Number.parseInt(readArg('branch-id'), 10);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    const error = new Error(
      'Usage: node scripts/inventory-recovery/plan-simple-stock-backfill-execution.js --branch-id=<positive integer> --manifest-id=<manifestId> --snapshot-hash=<sourceSnapshotHash> --operator=<operatorIdentity>'
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
  const manifestId = readArg('manifest-id');
  const sourceSnapshotHash = readArg('snapshot-hash');
  const operatorIdentity = readArg('operator');
  const snapshot = await loadBranchSnapshot(branchId);

  const dryRunResult = validateSimpleStockBackfillApprovalDryRun({
    branchId,
    manifestId,
    sourceSnapshotHash,
    operatorIdentity,
    ...snapshot,
  });

  const executionPlan = buildSimpleStockBackfillExecutionPlan({ dryRunResult });

  process.stdout.write(`${JSON.stringify({
    dryRunValidation: {
      result: dryRunResult.validation.result,
      stale: dryRunResult.validation.stale,
      readyEntryCount: dryRunResult.validation.readyEntryCount,
      blockedEntryCount: dryRunResult.validation.blockedEntryCount,
    },
    executionPlan,
  }, null, 2)}\n`);
};

main()
  .catch((error) => {
    console.error('[simple-stock-backfill-execution-plan] FAIL', {
      code: error?.code || 'SIMPLE_STOCK_BACKFILL_EXECUTION_PLAN_FAILED',
      message: error?.message || String(error),
      details: error?.details || null,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    if (typeof prisma?.$disconnect === 'function') {
      await prisma.$disconnect();
    }
  });
