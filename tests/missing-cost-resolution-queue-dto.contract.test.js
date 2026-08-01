const assert = require('assert');
const {
  buildMissingCostResolutionQueue,
} = require('../src/modules/inventory/recovery/missing-cost-resolution/queue/buildMissingCostResolutionQueue');
const {
  API_VERSION,
  buildQueueResponseDto,
  buildDetailResponseDto,
  buildProposalRequestDto,
  buildDecisionRequestDto,
  buildRecoveryEligibilityDto,
} = require('../src/modules/inventory/recovery/missing-cost-resolution/contracts/missingCostResolutionDtoContract');

const branchId = 2;

const makeEntry = (entryId, stockBalanceId, productId, overrides = {}) => {
  const {
    preconditions: preconditionOverrides = {},
    movementSummary: movementSummaryOverrides = {},
    ...entryOverrides
  } = overrides;

  return {
    entryId,
    classification: 'BLOCKED_MISSING_COST',
    reasonCode: 'NO_DEFENSIBLE_COST_FOR_RECOVERY_LOT',
    preconditions: {
      branchId,
      stockBalanceId,
      productId,
      quantity: 3,
      reserved: 0,
      avgCost: 0,
      lastReceivedCost: 0,
      movementCount: 1,
      movementIds: [1000 + stockBalanceId],
      movementEvidenceHash: `movement-${stockBalanceId}`,
      ...preconditionOverrides,
    },
    preconditionHash: `precondition-${stockBalanceId}`,
    movementSummary: {
      movementCount: 1,
      movementNetQuantity: -1,
      balanceQuantity: 3,
      difference: -4,
      ...movementSummaryOverrides,
    },
    ...entryOverrides,
  };
};

const audit = {
  branchId,
  auditId: 'post-usmr-2-test',
  sourceSnapshotHash: 'audit-snapshot-test',
  missingCostEntries: [
    makeEntry('branch-2-balance-1', 1, 101),
    makeEntry('branch-2-balance-2', 2, 102),
    makeEntry('branch-2-balance-3', 3, 103),
    makeEntry('branch-9-balance-4', 4, 104, {
      preconditions: { branchId: 9 },
    }),
  ],
};

const queue = buildMissingCostResolutionQueue({
  branchId,
  audit,
  resolutions: [
    {
      id: 20,
      branchId,
      entryId: 'branch-2-balance-2',
      version: 1,
      status: 'APPROVED',
      evidenceHash: 'approved-hash',
    },
    {
      id: 30,
      branchId,
      entryId: 'branch-2-balance-3',
      version: 1,
      status: 'DRAFT',
      evidenceHash: 'draft-hash',
    },
    {
      id: 31,
      branchId: 8,
      entryId: 'branch-2-balance-1',
      version: 99,
      status: 'APPROVED',
      evidenceHash: 'cross-branch-must-not-apply',
    },
  ],
});

assert.strictEqual(queue.queueVersion, 'missing-cost-resolution-queue-v1');
assert.strictEqual(queue.branchId, branchId);
assert.strictEqual(queue.mode, 'READ_ONLY_QUEUE');
assert.strictEqual(queue.mutationPerformed, false);
assert.strictEqual(queue.candidates.length, 2);
assert.deepStrictEqual(
  queue.candidates.map((candidate) => candidate.stockBalanceId),
  [1, 3]
);
assert.ok(queue.candidates.every((candidate) => candidate.branchId === branchId));
assert.ok(!queue.candidates.some((candidate) => candidate.entryId === 'branch-9-balance-4'));
assert.strictEqual(queue.candidates[0].status, 'UNRESOLVED');
assert.strictEqual(queue.candidates[1].status, 'DRAFT');
assert.strictEqual(queue.safetyContract.excludesApprovedAndRecovered, true);
assert.strictEqual(queue.safetyContract.directInventoryMutationAllowed, false);

const deterministicQueue = buildMissingCostResolutionQueue({
  branchId,
  audit,
  resolutions: [
    {
      id: 20,
      branchId,
      entryId: 'branch-2-balance-2',
      version: 1,
      status: 'APPROVED',
      evidenceHash: 'approved-hash',
    },
    {
      id: 30,
      branchId,
      entryId: 'branch-2-balance-3',
      version: 1,
      status: 'DRAFT',
      evidenceHash: 'draft-hash',
    },
  ],
});
assert.strictEqual(deterministicQueue.queueId, queue.queueId);
assert.strictEqual(deterministicQueue.sourceSnapshotHash, queue.sourceSnapshotHash);

assert.throws(
  () => buildMissingCostResolutionQueue({ branchId: 3, audit }),
  (error) => error.code === 'MISSING_COST_QUEUE_BRANCH_SCOPE_MISMATCH'
);

const queueDto = buildQueueResponseDto(queue);
assert.strictEqual(queueDto.apiVersion, API_VERSION);
assert.strictEqual(queueDto.mode, 'READ_ONLY_QUEUE');
assert.strictEqual(queueDto.mutationPerformed, false);
assert.strictEqual(queueDto.capabilities.executeInventoryRecovery, false);
assert.strictEqual(queueDto.items.length, 2);

const candidate = queue.candidates[0];
const detailDto = buildDetailResponseDto({
  candidate,
  resolution: null,
  auditEvents: [
    {
      eventId: 'event-1',
      previousStatus: null,
      resultingStatus: 'DRAFT',
      actorIdentity: 'employee:35',
      reasonCode: 'PROPOSAL_CREATED',
      note: 'test',
      evidenceHash: 'evidence-1',
      occurredAt: '2026-08-01T00:00:00.000Z',
    },
  ],
});
assert.strictEqual(detailDto.capabilities.executeInventoryRecovery, false);
assert.strictEqual(detailDto.capabilities.viewRecoveryPreviewEligibility, true);
assert.strictEqual(detailDto.auditEvents.length, 1);

const proposalDto = buildProposalRequestDto({
  branchId,
  candidateId: candidate.candidateId,
  candidateSourceSnapshotHash: candidate.sourceSnapshotHash,
  evidenceSourceType: 'SUPPLIER_DOCUMENT',
  sourceReference: 'INV-001',
  evidenceSummary: 'Supplier invoice confirms historical unit cost',
  proposedUnitCost: 250,
  effectiveDate: '2026-07-01',
  confidence: 'HIGH',
  rationale: 'Matched supplier and product reference',
});
assert.strictEqual(proposalDto.proposedUnitCost, 250);

const decisionDto = buildDecisionRequestDto({
  branchId,
  resolutionId: 500,
  expectedStatus: 'SUBMITTED',
  expectedEvidenceHash: 'hash-500',
  decision: 'APPROVE',
  reasonCode: 'EVIDENCE_VERIFIED',
  note: 'approved',
});
assert.strictEqual(decisionDto.decision, 'APPROVE');

const eligibilityDto = buildRecoveryEligibilityDto({
  resolution: { id: 500, status: 'APPROVED' },
  candidate,
});
assert.strictEqual(eligibilityDto.eligibleForFreshPreview, true);
assert.strictEqual(eligibilityDto.directExecutionAllowed, false);
assert.deepStrictEqual(eligibilityDto.requiredAuthorityChain, [
  'FRESH_RECOVERY_MANIFEST',
  'FRESH_SOURCE_SNAPSHOT_HASH',
  'FRESH_EXECUTION_PLAN',
  'EXPLICIT_EXECUTION_APPROVAL',
  'SERIALIZABLE_TRANSACTION',
]);

console.log('missing-cost-resolution-queue-dto.contract.test.js: PASS');
