#!/usr/bin/env node

const prismaModule = require('../../lib/prisma');
const prisma = prismaModule?.prisma || prismaModule;
const {
  validateUnlinkedSimpleMovementRecoveryApprovalDryRun,
} = require('../../src/modules/inventory/recovery/unlinked-simple-movement/approval/validateUnlinkedSimpleMovementRecoveryApprovalDryRun');
const {
  buildUnlinkedSimpleMovementRecoveryExecutionPlan,
} = require('../../src/modules/inventory/recovery/unlinked-simple-movement/execution-plan/buildUnlinkedSimpleMovementRecoveryExecutionPlan');

const readArg = (name) => {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  return raw ? raw.slice(prefix.length).trim() : '';
};

const readBranchId = () => {
  const branchId = Number.parseInt(readArg('branch-id'), 10);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    const error = new Error(
      'Usage: node scripts/inventory-recovery/plan-unlinked-simple-movement-recovery.js --branch-id=<positive integer> --manifest-id=<manifestId> --snapshot-hash=<sourceSnapshotHash> --operator=<operatorIdentity>'
    );
    error.code = 'INVENTORY_BRANCH_SCOPE_REQUIRED';
    throw error;
  }
  return branchId;
};

const requireText = (name) => {
  const value = readArg(name);
  if (!value) {
    const error = new Error(`--${name} is required`);
    error.code = 'UNLINKED_SIMPLE_MOVEMENT_PLAN_INPUT_REQUIRED';
    error.details = { input: name };
    throw error;
  }
  return value;
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
      select: { id: true, branchId: true, productId: true },
      orderBy: [{ productId: 'asc' }, { id: 'asc' }],
    }),
    prisma.stockMovement.findMany({
      where: { branchId },
      select: {
        id: true,
        branchId: true,
        productId: true,
        qty: true,
        type: true,
        refType: true,
        refId: true,
        simpleLotId: true,
        performedByEmployeeId: true,
        occurredAt: true,
        createdAt: true,
      },
      orderBy: [
        { productId: 'asc' },
        { occurredAt: 'asc' },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
    }),
  ]);

  return { balances, lots, movements };
};

const main = async () => {
  const branchId = readBranchId();
  const manifestId = requireText('manifest-id');
  const sourceSnapshotHash = requireText('snapshot-hash');
  const operatorIdentity = requireText('operator');
  const snapshot = await loadBranchSnapshot(branchId);

  const dryRunResult = validateUnlinkedSimpleMovementRecoveryApprovalDryRun({
    branchId,
    manifestId,
    sourceSnapshotHash,
    operatorIdentity,
    ...snapshot,
  });
  const executionPlan = buildUnlinkedSimpleMovementRecoveryExecutionPlan({
    dryRunResult,
  });

  process.stdout.write(`${JSON.stringify({
    dryRunValidation: dryRunResult.validation,
    executionPlan,
  }, null, 2)}\n`);
};

main()
  .catch((error) => {
    console.error('[unlinked-simple-movement-recovery-plan] FAIL', {
      code: error?.code || 'UNLINKED_SIMPLE_MOVEMENT_RECOVERY_PLAN_FAILED',
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
