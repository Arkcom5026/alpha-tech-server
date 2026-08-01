#!/usr/bin/env node

const prismaModule = require('../../lib/prisma');
const prisma = prismaModule?.prisma || prismaModule;
const {
  buildPostRecoverySimpleInventoryAudit,
} = require('../../src/modules/inventory/recovery/unlinked-simple-movement/post-recovery-audit/buildPostRecoverySimpleInventoryAudit');

const readPositiveIntegerArg = (name) => {
  const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  const value = Number.parseInt(String(raw || '').split('=')[1], 10);
  if (!Number.isInteger(value) || value <= 0) {
    const error = new Error(`A positive --${name}=<integer> is required`);
    error.code = 'POST_RECOVERY_AUDIT_ARGUMENT_REQUIRED';
    throw error;
  }
  return value;
};

const readNonNegativeIntegerArg = (name, fallback) => {
  const raw = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const value = Number.parseInt(String(raw).split('=')[1], 10);
  if (!Number.isInteger(value) || value < 0) {
    const error = new Error(`A non-negative --${name}=<integer> is required`);
    error.code = 'POST_RECOVERY_AUDIT_ARGUMENT_INVALID';
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
  const branchId = readPositiveIntegerArg('branch-id');
  const baseline = {
    reconciliationCount: readNonNegativeIntegerArg('expected-reconciliation', 75),
    missingCostCount: readNonNegativeIntegerArg('expected-missing-cost', 32),
    completedSafeToLinkCount: readNonNegativeIntegerArg('expected-completed', 265),
  };

  const snapshot = await loadBranchSnapshot(branchId);
  const audit = buildPostRecoverySimpleInventoryAudit({
    branchId,
    ...snapshot,
    baseline,
  });

  process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
};

main()
  .catch((error) => {
    console.error('[post-recovery-simple-inventory-audit] FAIL', {
      code: error?.code || 'POST_RECOVERY_SIMPLE_INVENTORY_AUDIT_FAILED',
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
