#!/usr/bin/env node

const prismaModule = require('../../lib/prisma');
const prisma = prismaModule?.prisma || prismaModule;
const {
  buildUnlinkedSimpleMovementRecoveryManifest,
} = require('../../src/modules/inventory/recovery/unlinked-simple-movement/manifest/buildUnlinkedSimpleMovementRecoveryManifest');

const readBranchId = () => {
  const raw = process.argv.find((arg) => arg.startsWith('--branch-id='));
  const branchId = Number.parseInt(String(raw || '').split('=')[1], 10);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    const error = new Error(
      'Usage: node scripts/inventory-recovery/preview-unlinked-simple-movement-recovery.js --branch-id=<positive integer>'
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
  const snapshot = await loadBranchSnapshot(branchId);
  const manifest = buildUnlinkedSimpleMovementRecoveryManifest({
    branchId,
    ...snapshot,
  });

  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
};

main()
  .catch((error) => {
    console.error('[unlinked-simple-movement-recovery-preview] FAIL', {
      code: error?.code || 'UNLINKED_SIMPLE_MOVEMENT_RECOVERY_PREVIEW_FAILED',
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
