const crypto = require('crypto');

const MANIFEST_VERSION = 'simple-stock-backfill-manifest-v2';

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

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

const stableStringify = (value) => JSON.stringify(stableValue(value));

const sha256 = (value) => crypto
  .createHash('sha256')
  .update(stableStringify(value))
  .digest('hex');

const normalizeBalance = (row) => ({
  id: Number(row.id),
  branchId: Number(row.branchId),
  productId: Number(row.productId),
  quantity: toNumber(row.quantity),
  reserved: toNumber(row.reserved),
  avgCost: toNumber(row.avgCost),
  lastReceivedCost: toNumber(row.lastReceivedCost),
});

const classifyEntry = ({
  balance,
  lotCount,
  allMovementCount,
  linkedMovementCount,
  unlinkedMovementCount,
}) => {
  const usableCost = balance.avgCost > 0
    ? { value: balance.avgCost, source: 'STOCK_BALANCE_AVG_COST' }
    : balance.lastReceivedCost > 0
      ? { value: balance.lastReceivedCost, source: 'STOCK_BALANCE_LAST_RECEIVED_COST' }
      : null;

  if (allMovementCount > 0) {
    return {
      classification: 'MANUAL_REVIEW',
      reasonCode: unlinkedMovementCount > 0
        ? 'LEGACY_BALANCE_HAS_UNLINKED_STOCK_MOVEMENT_HISTORY'
        : 'LEGACY_BALANCE_HAS_STOCK_MOVEMENT_HISTORY',
      proposedLot: null,
      movementEvidence: {
        allMovementCount,
        linkedMovementCount,
        unlinkedMovementCount,
      },
    };
  }

  if (balance.quantity > 0 && lotCount === 0) {
    if (usableCost) {
      return {
        classification: 'READY_FOR_APPROVAL',
        reasonCode: 'LEGACY_BALANCE_WITHOUT_LOT_HAS_DEFENSIBLE_COST',
        proposedLot: {
          qtyInitial: balance.quantity,
          qtyRemaining: balance.quantity,
          unitCost: usableCost.value,
          costSource: usableCost.source,
          status: 'ACTIVE',
        },
        movementEvidence: {
          allMovementCount,
          linkedMovementCount,
          unlinkedMovementCount,
        },
      };
    }

    return {
      classification: 'BLOCKED_MISSING_COST',
      reasonCode: 'LEGACY_BALANCE_WITHOUT_DEFENSIBLE_COST',
      proposedLot: null,
      movementEvidence: {
        allMovementCount,
        linkedMovementCount,
        unlinkedMovementCount,
      },
    };
  }

  return {
    classification: 'MANUAL_REVIEW',
    reasonCode: 'CURRENT_DATA_DOES_NOT_MATCH_DETERMINISTIC_BACKFILL_CONTRACT',
    proposedLot: null,
    movementEvidence: {
      allMovementCount,
      linkedMovementCount,
      unlinkedMovementCount,
    },
  };
};

const buildSimpleStockBackfillManifest = ({ branchId, balances, lots, movements }) => {
  const normalizedBranchId = Number(branchId);
  if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
    const error = new Error('A positive branchId is required to build a backfill manifest');
    error.code = 'INVENTORY_BRANCH_SCOPE_REQUIRED';
    throw error;
  }

  const scopedBalances = (balances || [])
    .map(normalizeBalance)
    .filter((row) => row.branchId === normalizedBranchId)
    .sort((a, b) => a.productId - b.productId || a.id - b.id);

  const scopedLots = (lots || [])
    .filter((row) => Number(row.branchId) === normalizedBranchId);
  const scopedMovements = (movements || [])
    .filter((row) => Number(row.branchId) === normalizedBranchId);

  const lotCountByProduct = new Map();
  const movementCountsByProduct = new Map();

  for (const row of scopedLots) {
    const productId = Number(row.productId);
    lotCountByProduct.set(productId, (lotCountByProduct.get(productId) || 0) + 1);
  }

  for (const row of scopedMovements) {
    const productId = Number(row.productId);
    const current = movementCountsByProduct.get(productId) || {
      allMovementCount: 0,
      linkedMovementCount: 0,
      unlinkedMovementCount: 0,
    };
    current.allMovementCount += 1;
    if (row.simpleLotId == null) current.unlinkedMovementCount += 1;
    else current.linkedMovementCount += 1;
    movementCountsByProduct.set(productId, current);
  }

  const entries = scopedBalances.map((balance) => {
    const lotCount = lotCountByProduct.get(balance.productId) || 0;
    const movementCounts = movementCountsByProduct.get(balance.productId) || {
      allMovementCount: 0,
      linkedMovementCount: 0,
      unlinkedMovementCount: 0,
    };
    const decision = classifyEntry({
      balance,
      lotCount,
      ...movementCounts,
    });
    const preconditions = {
      branchId: normalizedBranchId,
      stockBalanceId: balance.id,
      productId: balance.productId,
      quantity: balance.quantity,
      reserved: balance.reserved,
      avgCost: balance.avgCost,
      lastReceivedCost: balance.lastReceivedCost,
      lotCount,
      allMovementCount: movementCounts.allMovementCount,
      linkedMovementCount: movementCounts.linkedMovementCount,
      unlinkedMovementCount: movementCounts.unlinkedMovementCount,
    };

    return {
      entryId: `branch-${normalizedBranchId}-balance-${balance.id}`,
      classification: decision.classification,
      reasonCode: decision.reasonCode,
      preconditions,
      preconditionHash: sha256(preconditions),
      proposedLot: decision.proposedLot,
      movementEvidence: decision.movementEvidence,
    };
  });

  const sourceSnapshot = {
    version: MANIFEST_VERSION,
    branchId: normalizedBranchId,
    entries,
  };
  const sourceSnapshotHash = sha256(sourceSnapshot);

  const summary = entries.reduce((result, entry) => {
    const current = result[entry.classification] || { productCount: 0, quantity: 0 };
    current.productCount += 1;
    current.quantity += toNumber(entry.proposedLot?.qtyRemaining);
    result[entry.classification] = current;
    return result;
  }, {});

  return {
    manifestVersion: MANIFEST_VERSION,
    manifestId: `ssb-${normalizedBranchId}-${sourceSnapshotHash.slice(0, 24)}`,
    sourceSnapshotHash,
    branchId: normalizedBranchId,
    mode: 'PREVIEW_ONLY',
    mutationPerformed: false,
    summary,
    entries,
    approvalContract: {
      executable: false,
      requiresExplicitApproval: true,
      requiredApprovalInputs: ['manifestId', 'sourceSnapshotHash', 'operatorIdentity'],
      staleDataMustAbort: true,
    },
  };
};

module.exports = {
  MANIFEST_VERSION,
  buildSimpleStockBackfillManifest,
  stableStringify,
  sha256,
};
