const assert = require('assert');
const {
  CANDIDATE_STATUS,
  EVIDENCE_SOURCE_TYPE,
  CONFIDENCE,
  buildCandidateIdentity,
  buildEvidenceProposal,
  transitionProposal,
  buildRecoveryReevaluationContract,
} = require('../src/modules/inventory/recovery/missing-cost-resolution/contracts/missingCostResolutionContract');

const candidate = {
  branchId: 2,
  stockBalanceId: 6304,
  productId: 3361,
  sourceSnapshotHash: 'snapshot-branch-2-v1',
};

const makeProposal = (overrides = {}) => buildEvidenceProposal({
  candidate,
  sourceType: EVIDENCE_SOURCE_TYPE.LEGACY_INVOICE,
  sourceReference: 'LEGACY-INV-2024-001',
  evidenceSummary: 'Legacy supplier invoice confirms historical unit cost.',
  proposedUnitCost: 1250,
  effectiveDate: '2024-06-15T00:00:00.000Z',
  confidence: CONFIDENCE.HIGH,
  proposerIdentity: 'employee:35',
  rationale: 'Use documented purchase cost from the original supplier invoice.',
  ...overrides,
});

const expectErrorCode = (fn, expectedCode) => {
  assert.throws(fn, (error) => error && error.code === expectedCode);
};

const firstIdentity = buildCandidateIdentity(candidate);
const secondIdentity = buildCandidateIdentity({ ...candidate });
assert.deepStrictEqual(firstIdentity, secondIdentity);
assert.ok(firstIdentity.candidateId.startsWith('mcr-2-6304-'));

const firstProposal = makeProposal();
const secondProposal = makeProposal();
assert.strictEqual(firstProposal.evidenceHash, secondProposal.evidenceHash);
assert.strictEqual(firstProposal.proposalId, secondProposal.proposalId);
assert.strictEqual(firstProposal.status, CANDIDATE_STATUS.DRAFT);
assert.strictEqual(firstProposal.executable, false);
assert.strictEqual(firstProposal.inventoryMutationAllowed, false);

expectErrorCode(
  () => makeProposal({ proposedUnitCost: 0 }),
  'MISSING_COST_RESOLUTION_INVALID_COST'
);
expectErrorCode(
  () => makeProposal({ proposedUnitCost: -10 }),
  'MISSING_COST_RESOLUTION_INVALID_COST'
);
expectErrorCode(
  () => makeProposal({ sourceType: 'INVENTED_SOURCE' }),
  'MISSING_COST_RESOLUTION_UNSUPPORTED_EVIDENCE_SOURCE'
);
expectErrorCode(
  () => makeProposal({ sourceReference: '   ' }),
  'MISSING_COST_RESOLUTION_REQUIRED_FIELD'
);

const submitted = transitionProposal({
  proposal: firstProposal,
  toStatus: CANDIDATE_STATUS.SUBMITTED,
  actorIdentity: 'employee:35',
  actorBranchId: 2,
  reason: 'Submit documented cost evidence for approval.',
  occurredAt: '2026-08-01T02:30:00.000Z',
  expectedEvidenceHash: firstProposal.evidenceHash,
});
assert.strictEqual(submitted.proposal.status, CANDIDATE_STATUS.SUBMITTED);
assert.strictEqual(submitted.event.appendOnly, true);
assert.strictEqual(submitted.event.previousStatus, CANDIDATE_STATUS.DRAFT);
assert.strictEqual(submitted.event.resultingStatus, CANDIDATE_STATUS.SUBMITTED);

expectErrorCode(
  () => transitionProposal({
    proposal: submitted.proposal,
    toStatus: CANDIDATE_STATUS.APPROVED,
    actorIdentity: 'employee:99',
    actorBranchId: 3,
    reason: 'Cross-branch approval attempt.',
    expectedEvidenceHash: submitted.proposal.evidenceHash,
  }),
  'MISSING_COST_RESOLUTION_BRANCH_SCOPE_VIOLATION'
);

expectErrorCode(
  () => transitionProposal({
    proposal: submitted.proposal,
    toStatus: CANDIDATE_STATUS.APPROVED,
    actorIdentity: 'employee:99',
    actorBranchId: 2,
    reason: 'Approval against stale evidence.',
    expectedEvidenceHash: 'stale-hash',
  }),
  'MISSING_COST_RESOLUTION_STALE_EVIDENCE'
);

expectErrorCode(
  () => transitionProposal({
    proposal: submitted.proposal,
    toStatus: CANDIDATE_STATUS.APPROVED,
    actorIdentity: 'employee:35',
    actorBranchId: 2,
    reason: 'Self approval attempt.',
    enforceSeparateApprover: true,
    expectedEvidenceHash: submitted.proposal.evidenceHash,
  }),
  'MISSING_COST_RESOLUTION_SELF_APPROVAL_FORBIDDEN'
);

const approved = transitionProposal({
  proposal: submitted.proposal,
  toStatus: CANDIDATE_STATUS.APPROVED,
  actorIdentity: 'employee:99',
  actorBranchId: 2,
  reason: 'Approve documented historical unit cost.',
  occurredAt: '2026-08-01T02:35:00.000Z',
  enforceSeparateApprover: true,
  expectedEvidenceHash: submitted.proposal.evidenceHash,
});
assert.strictEqual(approved.proposal.status, CANDIDATE_STATUS.APPROVED);
assert.strictEqual(approved.proposal.approvedEvidenceImmutable, true);
assert.strictEqual(approved.proposal.executable, false);
assert.strictEqual(approved.proposal.inventoryMutationAllowed, false);

const reevaluation = buildRecoveryReevaluationContract({ proposal: approved.proposal });
assert.strictEqual(reevaluation.eligibleForFreshRecoveryPreview, true);
assert.strictEqual(reevaluation.directRecoveryExecutionAllowed, false);
assert.strictEqual(reevaluation.requiresFreshManifest, true);
assert.strictEqual(reevaluation.requiresFreshPlanIdAndHash, true);
assert.strictEqual(reevaluation.requiresExplicitExecutionApproval, true);
assert.strictEqual(reevaluation.requiresSerializableTransaction, true);
assert.strictEqual(reevaluation.inventoryMutationPerformed, false);

expectErrorCode(
  () => buildRecoveryReevaluationContract({ proposal: submitted.proposal }),
  'MISSING_COST_RESOLUTION_NOT_APPROVED'
);

expectErrorCode(
  () => transitionProposal({
    proposal: approved.proposal,
    toStatus: CANDIDATE_STATUS.REJECTED,
    actorIdentity: 'employee:99',
    actorBranchId: 2,
    reason: 'Invalid terminal transition.',
    expectedEvidenceHash: approved.proposal.evidenceHash,
  }),
  'MISSING_COST_RESOLUTION_INVALID_TRANSITION'
);

console.log('missing-cost-resolution-framework.contract.test.js: PASS');
