const crypto = require('crypto');

const PLAN_VERSION = 'unlinked-simple-movement-recovery-plan-v2';
const RECOVERY_BARCODE_PREFIX = 'RCV-USMR';

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = stableValue(value[key]);
    return result;
  }, {});
};

const sha256 = (value) => crypto
  .createHash('sha256')
  .update(JSON.stringify(stableValue(value)))
  .digest('hex');

const requireAuthorityText = (value, field) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    const error = new Error(`Validated dry-run authority is missing ${field}`);
    error.code = 'UNLINKED_SIMPLE_MOVEMENT_DRY_RUN_AUTHORITY_REQUIRED';
    error.details = { field };
    throw error;
  }
  return normalized;
};

const requireAuthorityBranchId = (value) => {
  const branchId = Number(value);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    const error = new Error('Validated dry-run authority is missing a positive branchId');
    error.code = 'UNLINKED_SIMPLE_MOVEMENT_DRY_RUN_AUTHORITY_REQUIRED';
    error.details = { field: 'branchId' };
    throw error;
  }
  return branchId;
};

const buildRecoveryBarcode = ({
  branchId,
  productId,
  stockBalanceId,
  movementEvidenceHash,
}) => {
  const authorityHash = sha256({
    namespace: RECOVERY_BARCODE_PREFIX,
    branchId: Number(branchId),
    productId: Number(productId),
    stockBalanceId: Number(stockBalanceId),
    movementEvidenceHash: requireAuthorityText(
      movementEvidenceHash,
      'movementEvidenceHash'
    ),
  });

  return `${RECOVERY_BARCODE_PREFIX}-${Number(branchId)}-${Number(productId)}-${authorityHash.slice(0, 20)}`;
};

const buildUnlinkedSimpleMovementRecoveryExecutionPlan = ({ dryRunResult }) => {
  if (!dryRunResult || dryRunResult.validation?.result !== 'VALIDATED_DRY_RUN_ONLY') {
    const error = new Error('A validated unlinked movement recovery dry run is required');
    error.code = 'UNLINKED_SIMPLE_MOVEMENT_VALIDATED_DRY_RUN_REQUIRED';
    throw error;
  }

  if (dryRunResult.validation?.stale) {
    const error = new Error('Stale unlinked movement recovery data cannot produce a plan');
    error.code = 'UNLINKED_SIMPLE_MOVEMENT_STALE_DATA';
    throw error;
  }

  const branchId = requireAuthorityBranchId(dryRunResult.authority?.branchId);
  const manifestId = requireAuthorityText(
    dryRunResult.authority?.manifestId,
    'manifestId'
  );
  const sourceSnapshotHash = requireAuthorityText(
    dryRunResult.authority?.sourceSnapshotHash,
    'sourceSnapshotHash'
  );
  const operatorIdentity = requireAuthorityText(
    dryRunResult.validation?.operatorIdentity,
    'operatorIdentity'
  );

  const operations = (dryRunResult.readyEntries || [])
    .map((entry) => {
      const operationBranchId = Number(entry.preconditions.branchId);
      const stockBalanceId = Number(entry.preconditions.stockBalanceId);
      const productId = Number(entry.preconditions.productId);
      const movementEvidenceHash = entry.preconditions.movementEvidenceHash;

      return {
        sequence: 0,
        operationType: 'CREATE_SIMPLE_LOT_AND_LINK_EXISTING_MOVEMENT',
        entryId: entry.entryId,
        branchId: operationBranchId,
        stockBalanceId,
        productId,
        preconditionHash: entry.preconditionHash,
        movementEvidenceHash,
        createLot: {
          barcode: buildRecoveryBarcode({
            branchId: operationBranchId,
            productId,
            stockBalanceId,
            movementEvidenceHash,
          }),
          qtyInitial: entry.proposedRecovery.qtyInitial,
          qtyRemaining: entry.proposedRecovery.qtyRemaining,
          unitCost: entry.proposedRecovery.unitCost,
          costSource: entry.proposedRecovery.costSource,
          status: entry.proposedRecovery.status,
        },
        linkExistingMovementIds: [...entry.proposedRecovery.movementIdsToLink]
          .map(Number)
          .sort((a, b) => a - b),
        impact: {
          quantity: Number(entry.proposedRecovery.qtyRemaining),
          unitCost: Number(entry.proposedRecovery.unitCost),
          inventoryValue:
            Number(entry.proposedRecovery.qtyRemaining)
            * Number(entry.proposedRecovery.unitCost),
        },
      };
    })
    .sort((a, b) => a.productId - b.productId || a.stockBalanceId - b.stockBalanceId)
    .map((operation, index) => ({ ...operation, sequence: index + 1 }));

  const barcodeSet = new Set(operations.map((operation) => operation.createLot.barcode));
  if (barcodeSet.size !== operations.length) {
    const error = new Error('Deterministic recovery barcodes must be unique within the plan');
    error.code = 'UNLINKED_SIMPLE_MOVEMENT_RECOVERY_BARCODE_COLLISION';
    throw error;
  }

  const totals = operations.reduce((result, operation) => {
    result.operationCount += 1;
    result.productCount += 1;
    result.totalQuantity += operation.impact.quantity;
    result.totalInventoryValue += operation.impact.inventoryValue;
    result.movementLinkCount += operation.linkExistingMovementIds.length;
    return result;
  }, {
    operationCount: 0,
    productCount: 0,
    totalQuantity: 0,
    totalInventoryValue: 0,
    movementLinkCount: 0,
  });

  const authority = {
    version: PLAN_VERSION,
    branchId,
    manifestId,
    sourceSnapshotHash,
    operatorIdentity,
    operations,
    totals,
  };
  const executionPlanHash = sha256(authority);

  return {
    planVersion: PLAN_VERSION,
    executionPlanId: `usmr-plan-${branchId}-${executionPlanHash.slice(0, 24)}`,
    executionPlanHash,
    branchId,
    manifestId,
    sourceSnapshotHash,
    operatorIdentity,
    mode: 'PLAN_ONLY',
    mutationPerformed: false,
    executable: false,
    approvedForMutation: false,
    totals,
    operations,
    blockedEntries: dryRunResult.blockedEntries || [],
    approvalContract: {
      requiresExplicitApproval: true,
      requiredApprovalInputs: [
        'manifestId',
        'sourceSnapshotHash',
        'executionPlanId',
        'executionPlanHash',
        'operatorIdentity',
      ],
      deterministicBarcodeRequired: true,
      staleDataMustAbort: true,
      mutationRequiresSeparateIncrement: true,
    },
  };
};

module.exports = {
  PLAN_VERSION,
  RECOVERY_BARCODE_PREFIX,
  buildRecoveryBarcode,
  buildUnlinkedSimpleMovementRecoveryExecutionPlan,
  sha256,
};
