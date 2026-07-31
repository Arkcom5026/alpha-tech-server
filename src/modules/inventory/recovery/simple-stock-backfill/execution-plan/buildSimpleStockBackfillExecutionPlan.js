const crypto = require('crypto');

const EXECUTION_PLAN_VERSION = 'simple-stock-backfill-execution-plan-v1';

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
};

const sha256 = (value) => crypto
  .createHash('sha256')
  .update(JSON.stringify(stableValue(value)))
  .digest('hex');

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const createPlanError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const buildSimpleStockBackfillExecutionPlan = ({ dryRunResult }) => {
  if (!dryRunResult || typeof dryRunResult !== 'object') {
    throw createPlanError(
      'SIMPLE_STOCK_BACKFILL_DRY_RUN_REQUIRED',
      'A validated dry-run result is required'
    );
  }

  if (dryRunResult.mode !== 'DRY_RUN_ONLY') {
    throw createPlanError(
      'SIMPLE_STOCK_BACKFILL_DRY_RUN_MODE_INVALID',
      'Execution plan requires a DRY_RUN_ONLY result'
    );
  }

  if (dryRunResult.validation?.result !== 'VALIDATED_DRY_RUN_ONLY' || dryRunResult.validation?.stale) {
    throw createPlanError(
      'SIMPLE_STOCK_BACKFILL_DRY_RUN_NOT_VALIDATED',
      'Execution plan cannot be generated from stale or unvalidated data'
    );
  }

  if (dryRunResult.mutationPerformed !== false || dryRunResult.executable !== false) {
    throw createPlanError(
      'SIMPLE_STOCK_BACKFILL_DRY_RUN_SAFETY_CONTRACT_INVALID',
      'Dry-run safety contract is invalid'
    );
  }

  const branchId = Number(dryRunResult.branchId);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    throw createPlanError(
      'INVENTORY_BRANCH_SCOPE_REQUIRED',
      'A positive branchId is required'
    );
  }

  const readyEntries = Array.isArray(dryRunResult.readyEntries)
    ? dryRunResult.readyEntries
    : [];
  const blockedEntries = Array.isArray(dryRunResult.blockedEntries)
    ? dryRunResult.blockedEntries
    : [];

  const operations = readyEntries.map((entry, index) => {
    const proposedLot = entry.proposedLot || {};
    const quantity = toNumber(proposedLot.qtyRemaining);
    const unitCost = toNumber(proposedLot.unitCost);

    if (quantity <= 0 || unitCost <= 0) {
      throw createPlanError(
        'SIMPLE_STOCK_BACKFILL_READY_ENTRY_INVALID',
        `Ready entry ${entry.entryId || index} has invalid quantity or cost`
      );
    }

    return {
      sequence: index + 1,
      entryId: String(entry.entryId),
      preconditionHash: String(entry.preconditionHash),
      actions: [
        {
          action: 'CREATE_SIMPLE_LOT',
          payload: {
            branchId,
            qtyInitial: quantity,
            qtyRemaining: quantity,
            unitCost,
            status: proposedLot.status || 'ACTIVE',
            source: 'LEGACY_BACKFILL_EXECUTION_PLAN',
          },
        },
        {
          action: 'CREATE_STOCK_MOVEMENT',
          payload: {
            branchId,
            qty: quantity,
            type: 'LEGACY_BACKFILL',
            refType: 'SIMPLE_STOCK_BACKFILL',
            note: `Planned legacy backfill for ${entry.entryId}`,
          },
        },
      ],
      impact: {
        quantity,
        unitCost,
        inventoryValue: quantity * unitCost,
      },
      rollbackPlan: {
        strategy: 'TRANSACTION_ABORT_BEFORE_COMMIT',
        postCommitCompensationAllowed: false,
      },
    };
  });

  const totals = operations.reduce((result, operation) => {
    result.operationCount += operation.actions.length;
    result.readyEntryCount += 1;
    result.totalQuantity += operation.impact.quantity;
    result.totalInventoryValue += operation.impact.inventoryValue;
    return result;
  }, {
    operationCount: 0,
    readyEntryCount: 0,
    blockedEntryCount: blockedEntries.length,
    totalQuantity: 0,
    totalInventoryValue: 0,
  });

  const planSource = {
    version: EXECUTION_PLAN_VERSION,
    branchId,
    operatorIdentity: dryRunResult.operatorIdentity,
    submittedApproval: dryRunResult.submittedApproval,
    currentManifest: dryRunResult.currentManifest,
    operations,
    blockedEntries,
  };
  const planHash = sha256(planSource);

  return {
    executionPlanVersion: EXECUTION_PLAN_VERSION,
    executionPlanId: `ssb-plan-${branchId}-${planHash.slice(0, 24)}`,
    executionPlanHash: planHash,
    branchId,
    operatorIdentity: dryRunResult.operatorIdentity,
    sourceApproval: {
      manifestId: dryRunResult.currentManifest?.manifestId || null,
      sourceSnapshotHash: dryRunResult.currentManifest?.sourceSnapshotHash || null,
    },
    mode: 'PLAN_ONLY',
    mutationPerformed: false,
    executable: false,
    approvedForMutation: false,
    totals,
    operations,
    blockedEntries,
    executionGuards: {
      revalidateManifestBeforeExecution: true,
      revalidateEveryPreconditionHash: true,
      abortOnAnyDrift: true,
      transactionRequired: true,
      partialCommitAllowed: false,
      executionRequiresSeparateApprovedIncrement: true,
    },
  };
};

module.exports = {
  EXECUTION_PLAN_VERSION,
  buildSimpleStockBackfillExecutionPlan,
};
