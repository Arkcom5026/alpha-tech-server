const API_VERSION = 'missing-cost-resolution-api-v1';

const assertPositiveInteger = (value, field) => {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    const error = new Error(`${field} must be a positive integer`);
    error.code = 'MISSING_COST_DTO_INVALID_FIELD';
    throw error;
  }
  return normalized;
};

const assertNonEmptyString = (value, field) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    const error = new Error(`${field} is required`);
    error.code = 'MISSING_COST_DTO_INVALID_FIELD';
    throw error;
  }
  return normalized;
};

const toQueueItemDto = (candidate) => ({
  candidateId: assertNonEmptyString(candidate.candidateId, 'candidateId'),
  branchId: assertPositiveInteger(candidate.branchId, 'branchId'),
  stockBalanceId: assertPositiveInteger(candidate.stockBalanceId, 'stockBalanceId'),
  productId: assertPositiveInteger(candidate.productId, 'productId'),
  status: assertNonEmptyString(candidate.status, 'status'),
  reasonCode: assertNonEmptyString(candidate.reasonCode, 'reasonCode'),
  quantity: Number(candidate.quantity || 0),
  currentCostEvidence: {
    avgCost: Number(candidate.currentCostEvidence?.avgCost || 0),
    lastReceivedCost: Number(candidate.currentCostEvidence?.lastReceivedCost || 0),
    hasDefensibleCost: Boolean(candidate.currentCostEvidence?.hasDefensibleCost),
  },
  movementSummary: {
    movementCount: Number(candidate.movementSummary?.movementCount || 0),
    movementNetQuantity: Number(candidate.movementSummary?.movementNetQuantity || 0),
    balanceQuantity: Number(candidate.movementSummary?.balanceQuantity || 0),
    difference: Number(candidate.movementSummary?.difference || 0),
  },
  sourceSnapshotHash: assertNonEmptyString(
    candidate.sourceSnapshotHash,
    'sourceSnapshotHash'
  ),
});

const buildQueueResponseDto = (queue) => ({
  apiVersion: API_VERSION,
  branchId: assertPositiveInteger(queue.branchId, 'branchId'),
  queueId: assertNonEmptyString(queue.queueId, 'queueId'),
  sourceSnapshotHash: assertNonEmptyString(queue.sourceSnapshotHash, 'sourceSnapshotHash'),
  mode: 'READ_ONLY_QUEUE',
  mutationPerformed: false,
  summary: {
    candidateCount: Number(queue.summary?.candidateCount || 0),
    unresolvedCount: Number(queue.summary?.unresolvedCount || 0),
    draftCount: Number(queue.summary?.draftCount || 0),
    submittedCount: Number(queue.summary?.submittedCount || 0),
    returnedCount: Number(queue.summary?.returnedCount || 0),
    rejectedCount: Number(queue.summary?.rejectedCount || 0),
  },
  items: (queue.candidates || []).map(toQueueItemDto),
  capabilities: {
    viewDetail: true,
    createProposal: true,
    submitProposal: true,
    reviewProposal: true,
    viewAuditHistory: true,
    executeInventoryRecovery: false,
  },
});

const buildDetailResponseDto = ({ candidate, resolution = null, auditEvents = [] }) => ({
  apiVersion: API_VERSION,
  candidate: {
    ...toQueueItemDto(candidate),
    entryId: assertNonEmptyString(candidate.entryId, 'entryId'),
    movementIds: [...(candidate.movementIds || [])].map(Number),
    movementEvidenceHash: assertNonEmptyString(
      candidate.movementEvidenceHash,
      'movementEvidenceHash'
    ),
    preconditionHash: assertNonEmptyString(candidate.preconditionHash, 'preconditionHash'),
    staleDataContract: {
      auditId: assertNonEmptyString(candidate.staleDataContract?.auditId, 'auditId'),
      auditSourceSnapshotHash: assertNonEmptyString(
        candidate.staleDataContract?.auditSourceSnapshotHash,
        'auditSourceSnapshotHash'
      ),
      candidateSourceSnapshotHash: assertNonEmptyString(
        candidate.staleDataContract?.candidateSourceSnapshotHash,
        'candidateSourceSnapshotHash'
      ),
    },
  },
  resolution,
  auditEvents: (auditEvents || []).map((event) => ({
    eventId: assertNonEmptyString(event.eventId, 'eventId'),
    previousStatus: event.previousStatus == null ? null : String(event.previousStatus),
    resultingStatus: assertNonEmptyString(event.resultingStatus, 'resultingStatus'),
    actorIdentity: assertNonEmptyString(event.actorIdentity, 'actorIdentity'),
    reasonCode: assertNonEmptyString(event.reasonCode, 'reasonCode'),
    note: event.note == null ? null : String(event.note),
    evidenceHash: event.evidenceHash == null ? null : String(event.evidenceHash),
    occurredAt: assertNonEmptyString(event.occurredAt, 'occurredAt'),
  })),
  capabilities: {
    saveDraft: true,
    submit: true,
    approve: true,
    reject: true,
    returnForCorrection: true,
    cancel: true,
    viewRecoveryPreviewEligibility: true,
    executeInventoryRecovery: false,
  },
});

const buildProposalRequestDto = (input) => ({
  apiVersion: API_VERSION,
  branchId: assertPositiveInteger(input.branchId, 'branchId'),
  candidateId: assertNonEmptyString(input.candidateId, 'candidateId'),
  candidateSourceSnapshotHash: assertNonEmptyString(
    input.candidateSourceSnapshotHash,
    'candidateSourceSnapshotHash'
  ),
  evidenceSourceType: assertNonEmptyString(input.evidenceSourceType, 'evidenceSourceType'),
  sourceReference: assertNonEmptyString(input.sourceReference, 'sourceReference'),
  evidenceSummary: assertNonEmptyString(input.evidenceSummary, 'evidenceSummary'),
  proposedUnitCost: Number(input.proposedUnitCost),
  effectiveDate: assertNonEmptyString(input.effectiveDate, 'effectiveDate'),
  confidence: assertNonEmptyString(input.confidence, 'confidence'),
  rationale: assertNonEmptyString(input.rationale, 'rationale'),
});

const buildDecisionRequestDto = (input) => ({
  apiVersion: API_VERSION,
  branchId: assertPositiveInteger(input.branchId, 'branchId'),
  resolutionId: assertPositiveInteger(input.resolutionId, 'resolutionId'),
  expectedStatus: assertNonEmptyString(input.expectedStatus, 'expectedStatus'),
  expectedEvidenceHash: assertNonEmptyString(input.expectedEvidenceHash, 'expectedEvidenceHash'),
  decision: assertNonEmptyString(input.decision, 'decision'),
  reasonCode: assertNonEmptyString(input.reasonCode, 'reasonCode'),
  note: input.note == null ? null : String(input.note),
});

const buildRecoveryEligibilityDto = ({ resolution, candidate }) => ({
  apiVersion: API_VERSION,
  branchId: assertPositiveInteger(candidate.branchId, 'branchId'),
  candidateId: assertNonEmptyString(candidate.candidateId, 'candidateId'),
  resolutionId: assertPositiveInteger(resolution.id, 'resolutionId'),
  resolutionStatus: assertNonEmptyString(resolution.status, 'resolutionStatus'),
  eligibleForFreshPreview: String(resolution.status) === 'APPROVED',
  directExecutionAllowed: false,
  requiredAuthorityChain: [
    'FRESH_RECOVERY_MANIFEST',
    'FRESH_SOURCE_SNAPSHOT_HASH',
    'FRESH_EXECUTION_PLAN',
    'EXPLICIT_EXECUTION_APPROVAL',
    'SERIALIZABLE_TRANSACTION',
  ],
});

module.exports = {
  API_VERSION,
  toQueueItemDto,
  buildQueueResponseDto,
  buildDetailResponseDto,
  buildProposalRequestDto,
  buildDecisionRequestDto,
  buildRecoveryEligibilityDto,
};
