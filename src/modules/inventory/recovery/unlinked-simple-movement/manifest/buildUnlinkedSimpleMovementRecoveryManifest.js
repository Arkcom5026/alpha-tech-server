const crypto = require('crypto');

const MANIFEST_VERSION = 'unlinked-simple-movement-recovery-manifest-v1';

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

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const normalizeBalance = (row) => ({
  id: Number(row.id),
  branchId: Number(row.branchId),
  productId: Number(row.productId),
  quantity: toNumber(row.quantity),
  reserved: toNumber(row.reserved),
  avgCost: toNumber(row.avgCost),
  lastReceivedCost: toNumber(row.lastReceivedCost),
});

const normalizeMovement = (row) => ({
  id: Number(row.id),
  branchId: Number(row.branchId),
  productId: Number(row.productId),
  qty: toNumber(row.qty),
  type: String(row.type || ''),
  refType: row.refType == null ? null : String(row.refType),
  refId: row.refId == null ? null : Number(row.refId),
  simpleLotId: row.simpleLotId == null ? null : Number(row.simpleLotId),
  performedByEmployeeId: row.performedByEmployeeId == null
    ? null
    : Number(row.performedByEmployeeId),
  occurredAt: row.occurredAt ? new Date(row.occurredAt).toISOString() : null,
  createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
});

const chooseCost = (balance) => {
  if (balance.avgCost > 0) {
    return { unitCost: balance.avgCost, costSource: 'STOCK_BALANCE_AVG_COST' };
  }
  if (balance.lastReceivedCost > 0) {
    return {
      unitCost: balance.lastReceivedCost,
      costSource: 'STOCK_BALANCE_LAST_RECEIVED_COST',
    };
  }
  return null;
};

const classify = ({ balance, movements }) => {
  const cost = chooseCost(balance);
  const movementNetQuantity = movements.reduce(
    (total, movement) => total + movement.qty,
    0
  );
  const hasMixedSigns = movements.some((movement) => movement.qty > 0)
    && movements.some((movement) => movement.qty < 0);
  const hasLinkedMovement = movements.some((movement) => movement.simpleLotId != null);
  const referenceKeys = new Set(
    movements.map((movement) => `${movement.refType || ''}:${movement.refId || ''}`)
  );
  const hasConflictingReferences = referenceKeys.size > 1;

  if (!cost) {
    return {
      classification: 'BLOCKED_MISSING_COST',
      reasonCode: 'NO_DEFENSIBLE_COST_FOR_RECOVERY_LOT',
      movementNetQuantity,
      proposedRecovery: null,
    };
  }

  if (
    movements.length === 1
    && !hasMixedSigns
    && !hasLinkedMovement
    && !hasConflictingReferences
    && movementNetQuantity === balance.quantity
    && movementNetQuantity > 0
  ) {
    return {
      classification: 'SAFE_TO_LINK',
      reasonCode: 'SINGLE_UNLINKED_MOVEMENT_MATCHES_CURRENT_BALANCE',
      movementNetQuantity,
      proposedRecovery: {
        qtyInitial: balance.quantity,
        qtyRemaining: balance.quantity,
        unitCost: cost.unitCost,
        costSource: cost.costSource,
        status: 'ACTIVE',
        movementIdsToLink: movements.map((movement) => movement.id),
      },
    };
  }

  return {
    classification: 'REQUIRES_MOVEMENT_RECONCILIATION',
    reasonCode: hasLinkedMovement
      ? 'MOVEMENT_SET_CONTAINS_ALREADY_LINKED_ROWS'
      : hasMixedSigns
        ? 'MOVEMENT_SET_HAS_MIXED_SIGNS'
        : hasConflictingReferences
          ? 'MOVEMENT_SET_HAS_CONFLICTING_REFERENCES'
          : movementNetQuantity !== balance.quantity
            ? 'MOVEMENT_NET_QUANTITY_DIFFERS_FROM_BALANCE'
            : 'MOVEMENT_SET_IS_NOT_DETERMINISTIC',
    movementNetQuantity,
    proposedRecovery: null,
  };
};

const buildUnlinkedSimpleMovementRecoveryManifest = ({
  branchId,
  balances,
  lots,
  movements,
}) => {
  const normalizedBranchId = Number(branchId);
  if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
    const error = new Error('A positive branchId is required');
    error.code = 'INVENTORY_BRANCH_SCOPE_REQUIRED';
    throw error;
  }

  const scopedBalances = (balances || [])
    .map(normalizeBalance)
    .filter((row) => row.branchId === normalizedBranchId)
    .sort((a, b) => a.productId - b.productId || a.id - b.id);

  const productsWithLots = new Set(
    (lots || [])
      .filter((row) => Number(row.branchId) === normalizedBranchId)
      .map((row) => Number(row.productId))
  );

  const movementsByProduct = new Map();
  for (const row of movements || []) {
    const movement = normalizeMovement(row);
    if (movement.branchId !== normalizedBranchId) continue;
    const current = movementsByProduct.get(movement.productId) || [];
    current.push(movement);
    movementsByProduct.set(movement.productId, current);
  }
  for (const rows of movementsByProduct.values()) {
    rows.sort((a, b) => a.id - b.id);
  }

  const entries = scopedBalances
    .filter((balance) => !productsWithLots.has(balance.productId))
    .map((balance) => {
      const evidence = movementsByProduct.get(balance.productId) || [];
      const decision = classify({ balance, movements: evidence });
      const preconditions = {
        branchId: normalizedBranchId,
        stockBalanceId: balance.id,
        productId: balance.productId,
        quantity: balance.quantity,
        reserved: balance.reserved,
        avgCost: balance.avgCost,
        lastReceivedCost: balance.lastReceivedCost,
        movementCount: evidence.length,
        movementIds: evidence.map((movement) => movement.id),
        movementEvidenceHash: sha256(evidence),
      };

      return {
        entryId: `branch-${normalizedBranchId}-balance-${balance.id}`,
        classification: decision.classification,
        reasonCode: decision.reasonCode,
        preconditions,
        preconditionHash: sha256(preconditions),
        movementSummary: {
          movementCount: evidence.length,
          movementNetQuantity: decision.movementNetQuantity,
          balanceQuantity: balance.quantity,
          difference: decision.movementNetQuantity - balance.quantity,
        },
        movements: evidence,
        proposedRecovery: decision.proposedRecovery,
      };
    });

  const sourceSnapshot = {
    version: MANIFEST_VERSION,
    branchId: normalizedBranchId,
    entries,
  };
  const sourceSnapshotHash = sha256(sourceSnapshot);

  const summary = entries.reduce((result, entry) => {
    const current = result[entry.classification] || {
      productCount: 0,
      quantity: 0,
    };
    current.productCount += 1;
    current.quantity += toNumber(entry.proposedRecovery?.qtyRemaining);
    result[entry.classification] = current;
    return result;
  }, {});

  return {
    manifestVersion: MANIFEST_VERSION,
    manifestId: `usmr-${normalizedBranchId}-${sourceSnapshotHash.slice(0, 24)}`,
    sourceSnapshotHash,
    branchId: normalizedBranchId,
    mode: 'PREVIEW_ONLY',
    mutationPerformed: false,
    summary,
    entries,
    approvalContract: {
      executable: false,
      mutationRequiresSeparateIncrement: true,
      staleDataMustAbort: true,
    },
  };
};

module.exports = {
  MANIFEST_VERSION,
  buildUnlinkedSimpleMovementRecoveryManifest,
  sha256,
};
