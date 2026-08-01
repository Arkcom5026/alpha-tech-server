const assert = require('assert');
const {
  AUDIT_VERSION,
  buildPostRecoverySimpleInventoryAudit,
} = require('../src/modules/inventory/recovery/unlinked-simple-movement/post-recovery-audit/buildPostRecoverySimpleInventoryAudit');

const branchId = 2;
const makeBalance = (id, productId, overrides = {}) => ({
  id,
  branchId,
  productId,
  quantity: 5,
  reserved: 0,
  avgCost: 100,
  lastReceivedCost: 100,
  ...overrides,
});
const makeMovement = (id, productId, qty, overrides = {}) => ({
  id,
  branchId,
  productId,
  qty,
  type: 'IN',
  refType: 'LEGACY_RECEIPT',
  refId: id,
  simpleLotId: null,
  performedByEmployeeId: 35,
  occurredAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const balances = [
  makeBalance(10, 100),
  makeBalance(11, 101),
  makeBalance(12, 102, { avgCost: 0, lastReceivedCost: 0 }),
  makeBalance(13, 103),
  makeBalance(99, 999, { branchId: 3 }),
];
const lots = [
  { id: 500, branchId, productId: 100 },
  { id: 900, branchId: 3, productId: 103 },
];
const movements = [
  makeMovement(1000, 100, 5, { simpleLotId: 500 }),
  makeMovement(1001, 101, 4),
  makeMovement(1002, 102, 5),
  makeMovement(1003, 103, 5),
  makeMovement(9999, 999, 5, { branchId: 3 }),
];

const baseline = {
  reconciliationCount: 1,
  missingCostCount: 1,
  completedSafeToLinkCount: 1,
};

const first = buildPostRecoverySimpleInventoryAudit({
  branchId,
  balances,
  lots,
  movements,
  baseline,
});
const second = buildPostRecoverySimpleInventoryAudit({
  branchId,
  balances: [...balances].reverse(),
  lots: [...lots].reverse(),
  movements: [...movements].reverse(),
  baseline,
});

assert.strictEqual(AUDIT_VERSION, 'post-recovery-simple-inventory-audit-v1');
assert.strictEqual(first.mode, 'POST_RECOVERY_AUDIT_PREVIEW_ONLY');
assert.strictEqual(first.mutationPerformed, false);
assert.strictEqual(first.safetyContract.executable, false);
assert.strictEqual(first.safetyContract.databaseMutationAllowed, false);

assert.strictEqual(first.summary.scopedBalanceCount, 4);
assert.strictEqual(first.summary.excludedBecauseLotExistsCount, 1);
assert.strictEqual(first.summary.reconciliationCount, 1);
assert.strictEqual(first.summary.missingCostCount, 1);
assert.strictEqual(first.summary.unexpectedSafeToLinkCount, 1);
assert.strictEqual(first.summary.unresolvedCandidateCount, 2);

assert.deepStrictEqual(first.excludedBecauseLotExists, [{
  stockBalanceId: 10,
  productId: 100,
  simpleLotIds: [500],
  reasonCode: 'EXCLUDED_EXISTING_SIMPLE_LOT',
}]);
assert.strictEqual(
  first.manifest.entries.some((entry) => entry.preconditions.productId === 100),
  false
);
assert.strictEqual(
  first.reconciliationEntries[0].reasonCode,
  'MOVEMENT_NET_QUANTITY_DIFFERS_FROM_BALANCE'
);
assert.strictEqual(
  first.missingCostEntries[0].reasonCode,
  'NO_DEFENSIBLE_COST_FOR_RECOVERY_LOT'
);
assert.strictEqual(first.unexpectedSafeToLinkEntries[0].preconditions.productId, 103);
assert.strictEqual(
  first.manifest.entries.some((entry) => entry.preconditions.productId === 999),
  false
);

assert.deepStrictEqual(first.baselineComparison.drift, {
  reconciliationCount: 0,
  missingCostCount: 0,
  completedSafeToLinkCount: 0,
});
assert.strictEqual(first.baselineComparison.matches, false);

assert.strictEqual(first.auditId, second.auditId);
assert.strictEqual(first.sourceSnapshotHash, second.sourceSnapshotHash);
assert.deepStrictEqual(first.summary, second.summary);
assert.deepStrictEqual(
  first.excludedBecauseLotExists,
  second.excludedBecauseLotExists
);

const cleanPostRecovery = buildPostRecoverySimpleInventoryAudit({
  branchId,
  balances: balances.filter((balance) => balance.productId !== 103),
  lots,
  movements: movements.filter((movement) => movement.productId !== 103),
  baseline,
});
assert.strictEqual(cleanPostRecovery.summary.unexpectedSafeToLinkCount, 0);
assert.strictEqual(cleanPostRecovery.baselineComparison.matches, true);

console.log('post-recovery simple inventory audit contract: PASS');
