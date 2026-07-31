#!/usr/bin/env node

const prismaModule = require('../../lib/prisma');
const prisma = prismaModule?.prisma || prismaModule;
const {
  executeUnlinkedSimpleMovementRecovery,
} = require('../../src/modules/inventory/recovery/unlinked-simple-movement/execution/executeUnlinkedSimpleMovementRecovery');

const readArg = (name) => {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  return raw ? raw.slice(prefix.length).trim() : '';
};

const requireText = (name) => {
  const value = readArg(name);
  if (!value) {
    const error = new Error(`--${name} is required`);
    error.code = 'UNLINKED_SIMPLE_MOVEMENT_EXECUTION_INPUT_REQUIRED';
    error.details = { input: name };
    throw error;
  }
  return value;
};

const readBranchId = () => {
  const branchId = Number.parseInt(requireText('branch-id'), 10);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    const error = new Error('--branch-id must be a positive integer');
    error.code = 'INVENTORY_BRANCH_SCOPE_REQUIRED';
    throw error;
  }
  return branchId;
};

const readApproved = () => {
  const value = readArg('approve');
  if (value !== 'EXECUTE_SAFE_TO_LINK') {
    const error = new Error(
      '--approve=EXECUTE_SAFE_TO_LINK is required for database mutation'
    );
    error.code = 'UNLINKED_SIMPLE_MOVEMENT_EXPLICIT_APPROVAL_REQUIRED';
    throw error;
  }
  return true;
};

const main = async () => {
  const branchId = readBranchId();
  const manifestId = requireText('manifest-id');
  const sourceSnapshotHash = requireText('snapshot-hash');
  const executionPlanId = requireText('plan-id');
  const executionPlanHash = requireText('plan-hash');
  const operatorIdentity = requireText('operator');
  const approved = readApproved();

  const result = await executeUnlinkedSimpleMovementRecovery({
    prisma,
    approval: {
      approved,
      branchId,
      manifestId,
      sourceSnapshotHash,
      executionPlanId,
      executionPlanHash,
      operatorIdentity,
    },
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};

main()
  .catch((error) => {
    console.error('[unlinked-simple-movement-recovery-execute] FAIL', {
      code: error?.code || 'UNLINKED_SIMPLE_MOVEMENT_RECOVERY_EXECUTION_FAILED',
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
