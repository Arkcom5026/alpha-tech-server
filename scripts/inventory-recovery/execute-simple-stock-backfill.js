#!/usr/bin/env node

const prismaModule = require('../../lib/prisma');
const prisma = prismaModule?.prisma || prismaModule;
const {
  validateSimpleStockBackfillApprovalDryRun,
} = require('../../src/modules/inventory/recovery/simple-stock-backfill/approval/validateSimpleStockBackfillApprovalDryRun');
const {
  buildSimpleStockBackfillExecutionPlan,
} = require('../../src/modules/inventory/recovery/simple-stock-backfill/execution-plan/buildSimpleStockBackfillExecutionPlan');
const {
  executeSimpleStockBackfill,
} = require('../../src/modules/inventory/recovery/simple-stock-backfill/execution/executeSimpleStockBackfill');
const executionRepository = require('../../src/modules/inventory/recovery/simple-stock-backfill/execution/simpleStockBackfillExecutionRepository');

const readArg = (name) => {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  return raw ? raw.slice(prefix.length).trim() : '';
};

const requireText = (name) => {
  const value = readArg(name);
  if (!value) {
    const error = new Error(`--${name} is required`);
    error.code = 'SIMPLE_STOCK_BACKFILL_RUNTIME_INPUT_REQUIRED';
    error.details = { input: name };
    throw error;
  }
  return value;
};

const readBranchId = () => {
  const branchId = Number.parseInt(readArg('branch-id'), 10);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    const error = new Error('A positive --branch-id is required');
    error.code = 'INVENTORY_BRANCH_SCOPE_REQUIRED';
    throw error;
  }
  return branchId;
};

const requireExplicitApproval = () => {
  const approval = readArg('approve');
  if (approval !== 'EXECUTE') {
    const error = new Error('Explicit mutation approval requires --approve=EXECUTE');
    error.code = 'SIMPLE_STOCK_BACKFILL_EXPLICIT_APPROVAL_REQUIRED';
    throw error;
  }
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
  requireExplicitApproval();

  const branchId = readBranchId();
  const manifestId = requireText('manifest-id');
  const sourceSnapshotHash = requireText('snapshot-hash');
  const executionPlanId = requireText('execution-plan-id');
  const executionPlanHash = requireText('execution-plan-hash');
  const operatorIdentity = requireText('operator');

  const snapshot = await loadBranchSnapshot(branchId);
  const dryRunResult = validateSimpleStockBackfillApprovalDryRun({
    branchId,
    manifestId,
    sourceSnapshotHash,
    operatorIdentity,
    ...snapshot,
  });

  if (dryRunResult.validation?.stale) {
    const error = new Error('Runtime snapshot is stale; execution aborted');
    error.code = 'SIMPLE_STOCK_BACKFILL_STALE_RUNTIME_SNAPSHOT';
    error.details = dryRunResult.validation.staleReasons;
    throw error;
  }

  const executionPlan = buildSimpleStockBackfillExecutionPlan({ dryRunResult });
  const approval = {
    explicitApproval: true,
    operatorIdentity,
    manifestId,
    sourceSnapshotHash,
    executionPlanId,
    executionPlanHash,
  };

  const result = await executeSimpleStockBackfill({
    executionPlan,
    approval,
    repository: executionRepository,
  });

  process.stdout.write(`${JSON.stringify({
    result: 'SIMPLE_STOCK_BACKFILL_EXECUTED',
    runtimeAuthority: {
      branchId,
      manifestId,
      sourceSnapshotHash,
      executionPlanId,
      executionPlanHash,
      operatorIdentity,
    },
    execution: result,
  }, null, 2)}\n`);
};

main()
  .catch((error) => {
    console.error('[simple-stock-backfill-runtime-execute] FAIL', {
      code: error?.code || 'SIMPLE_STOCK_BACKFILL_RUNTIME_EXECUTION_FAILED',
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
