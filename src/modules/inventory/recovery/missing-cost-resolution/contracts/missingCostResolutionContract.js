const crypto = require('crypto');

const MISSING_COST_RESOLUTION_CONTRACT_VERSION = 'missing-cost-resolution-contract-v1';

const CANDIDATE_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  RETURNED_FOR_CORRECTION: 'RETURNED_FOR_CORRECTION',
  CANCELLED: 'CANCELLED',
  SUPERSEDED: 'SUPERSEDED',
});

const EVIDENCE_SOURCE_TYPE = Object.freeze({
  LEGACY_INVOICE: 'LEGACY_INVOICE',
  SUPPLIER_DOCUMENT: 'SUPPLIER_DOCUMENT',
  PURCHASE_RECORD: 'PURCHASE_RECORD',
  HISTORICAL_COST_REFERENCE: 'HISTORICAL_COST_REFERENCE',
  MANUAL_BUSINESS_DECISION: 'MANUAL_BUSINESS_DECISION',
});

const CONFIDENCE = Object.freeze({
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [CANDIDATE_STATUS.DRAFT]: new Set([
    CANDIDATE_STATUS.SUBMITTED,
    CANDIDATE_STATUS.CANCELLED,
  ]),
  [CANDIDATE_STATUS.SUBMITTED]: new Set([
    CANDIDATE_STATUS.APPROVED,
    CANDIDATE_STATUS.REJECTED,
    CANDIDATE_STATUS.RETURNED_FOR_CORRECTION,
    CANDIDATE_STATUS.CANCELLED,
  ]),
  [CANDIDATE_STATUS.RETURNED_FOR_CORRECTION]: new Set([
    CANDIDATE_STATUS.SUBMITTED,
    CANDIDATE_STATUS.CANCELLED,
  ]),
  [CANDIDATE_STATUS.APPROVED]: new Set([
    CANDIDATE_STATUS.SUPERSEDED,
  ]),
  [CANDIDATE_STATUS.REJECTED]: new Set(),
  [CANDIDATE_STATUS.CANCELLED]: new Set(),
  [CANDIDATE_STATUS.SUPERSEDED]: new Set(),
});

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

const assertPositiveInteger = (value, fieldName) => {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    const error = new Error(`${fieldName} must be a positive integer`);
    error.code = 'MISSING_COST_RESOLUTION_INVALID_IDENTITY';
    error.details = { fieldName, value };
    throw error;
  }
  return normalized;
};

const assertNonEmptyString = (value, fieldName) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    const error = new Error(`${fieldName} is required`);
    error.code = 'MISSING_COST_RESOLUTION_REQUIRED_FIELD';
    error.details = { fieldName };
    throw error;
  }
  return normalized;
};

const normalizeUnitCost = (value) => {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    const error = new Error('proposedUnitCost must be greater than zero');
    error.code = 'MISSING_COST_RESOLUTION_INVALID_COST';
    error.details = { proposedUnitCost: value };
    throw error;
  }
  return normalized;
};

const assertSupportedEvidenceSource = (sourceType) => {
  const normalized = String(sourceType || '');
  if (!Object.values(EVIDENCE_SOURCE_TYPE).includes(normalized)) {
    const error = new Error('Unsupported evidence source type');
    error.code = 'MISSING_COST_RESOLUTION_UNSUPPORTED_EVIDENCE_SOURCE';
    error.details = { sourceType };
    throw error;
  }
  return normalized;
};

const assertSupportedConfidence = (confidence) => {
  const normalized = String(confidence || '');
  if (!Object.values(CONFIDENCE).includes(normalized)) {
    const error = new Error('Unsupported evidence confidence');
    error.code = 'MISSING_COST_RESOLUTION_UNSUPPORTED_CONFIDENCE';
    error.details = { confidence };
    throw error;
  }
  return normalized;
};

const buildCandidateIdentity = ({ branchId, stockBalanceId, productId, sourceSnapshotHash }) => {
  const identity = {
    branchId: assertPositiveInteger(branchId, 'branchId'),
    stockBalanceId: assertPositiveInteger(stockBalanceId, 'stockBalanceId'),
    productId: assertPositiveInteger(productId, 'productId'),
    sourceSnapshotHash: assertNonEmptyString(sourceSnapshotHash, 'sourceSnapshotHash'),
  };

  const identityHash = sha256(identity);
  return {
    ...identity,
    candidateId: `mcr-${identity.branchId}-${identity.stockBalanceId}-${identityHash.slice(0, 20)}`,
    candidateIdentityHash: identityHash,
  };
};

const buildEvidenceProposal = ({
  candidate,
  sourceType,
  sourceReference,
  evidenceSummary,
  proposedUnitCost,
  effectiveDate,
  confidence,
  proposerIdentity,
  rationale,
}) => {
  const normalizedCandidate = buildCandidateIdentity(candidate);
  const proposal = {
    contractVersion: MISSING_COST_RESOLUTION_CONTRACT_VERSION,
    candidateId: normalizedCandidate.candidateId,
    branchId: normalizedCandidate.branchId,
    stockBalanceId: normalizedCandidate.stockBalanceId,
    productId: normalizedCandidate.productId,
    candidateIdentityHash: normalizedCandidate.candidateIdentityHash,
    sourceSnapshotHash: normalizedCandidate.sourceSnapshotHash,
    sourceType: assertSupportedEvidenceSource(sourceType),
    sourceReference: assertNonEmptyString(sourceReference, 'sourceReference'),
    evidenceSummary: assertNonEmptyString(evidenceSummary, 'evidenceSummary'),
    proposedUnitCost: normalizeUnitCost(proposedUnitCost),
    effectiveDate: new Date(assertNonEmptyString(effectiveDate, 'effectiveDate')).toISOString(),
    confidence: assertSupportedConfidence(confidence),
    proposerIdentity: assertNonEmptyString(proposerIdentity, 'proposerIdentity'),
    rationale: assertNonEmptyString(rationale, 'rationale'),
    status: CANDIDATE_STATUS.DRAFT,
    executable: false,
    inventoryMutationAllowed: false,
  };

  proposal.evidenceHash = sha256(proposal);
  proposal.proposalId = `mcrp-${proposal.branchId}-${proposal.evidenceHash.slice(0, 24)}`;
  return proposal;
};

const assertTransitionAllowed = ({ fromStatus, toStatus }) => {
  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  if (!allowed || !allowed.has(toStatus)) {
    const error = new Error(`Invalid missing-cost resolution transition: ${fromStatus} -> ${toStatus}`);
    error.code = 'MISSING_COST_RESOLUTION_INVALID_TRANSITION';
    error.details = { fromStatus, toStatus };
    throw error;
  }
};

const transitionProposal = ({
  proposal,
  toStatus,
  actorIdentity,
  actorBranchId,
  reason,
  occurredAt,
  enforceSeparateApprover = false,
  expectedEvidenceHash,
}) => {
  const normalizedActorBranchId = assertPositiveInteger(actorBranchId, 'actorBranchId');
  const normalizedActorIdentity = assertNonEmptyString(actorIdentity, 'actorIdentity');
  const normalizedToStatus = String(toStatus || '');

  if (normalizedActorBranchId !== Number(proposal.branchId)) {
    const error = new Error('Cross-branch missing-cost resolution access is forbidden');
    error.code = 'MISSING_COST_RESOLUTION_BRANCH_SCOPE_VIOLATION';
    throw error;
  }

  if (expectedEvidenceHash && expectedEvidenceHash !== proposal.evidenceHash) {
    const error = new Error('Missing-cost resolution evidence is stale');
    error.code = 'MISSING_COST_RESOLUTION_STALE_EVIDENCE';
    throw error;
  }

  assertTransitionAllowed({ fromStatus: proposal.status, toStatus: normalizedToStatus });

  if (
    normalizedToStatus === CANDIDATE_STATUS.APPROVED
    && enforceSeparateApprover
    && normalizedActorIdentity === proposal.proposerIdentity
  ) {
    const error = new Error('Proposer cannot approve the same missing-cost resolution');
    error.code = 'MISSING_COST_RESOLUTION_SELF_APPROVAL_FORBIDDEN';
    throw error;
  }

  const event = {
    eventVersion: MISSING_COST_RESOLUTION_CONTRACT_VERSION,
    candidateId: proposal.candidateId,
    proposalId: proposal.proposalId,
    branchId: proposal.branchId,
    previousStatus: proposal.status,
    resultingStatus: normalizedToStatus,
    actorIdentity: normalizedActorIdentity,
    reason: assertNonEmptyString(reason, 'reason'),
    evidenceHash: proposal.evidenceHash,
    occurredAt: new Date(occurredAt || Date.now()).toISOString(),
    appendOnly: true,
  };
  event.eventHash = sha256(event);

  return {
    proposal: Object.freeze({
      ...proposal,
      status: normalizedToStatus,
      approvedEvidenceImmutable: normalizedToStatus === CANDIDATE_STATUS.APPROVED,
      executable: false,
      inventoryMutationAllowed: false,
    }),
    event: Object.freeze(event),
  };
};

const buildRecoveryReevaluationContract = ({ proposal }) => {
  if (proposal.status !== CANDIDATE_STATUS.APPROVED) {
    const error = new Error('Only approved cost evidence can be re-evaluated for recovery');
    error.code = 'MISSING_COST_RESOLUTION_NOT_APPROVED';
    throw error;
  }

  return Object.freeze({
    candidateId: proposal.candidateId,
    proposalId: proposal.proposalId,
    branchId: proposal.branchId,
    approvedEvidenceHash: proposal.evidenceHash,
    proposedUnitCost: proposal.proposedUnitCost,
    eligibleForFreshRecoveryPreview: true,
    directRecoveryExecutionAllowed: false,
    requiresFreshManifest: true,
    requiresFreshSourceSnapshotHash: true,
    requiresFreshPlanIdAndHash: true,
    requiresExplicitExecutionApproval: true,
    requiresSerializableTransaction: true,
    inventoryMutationPerformed: false,
  });
};

module.exports = {
  MISSING_COST_RESOLUTION_CONTRACT_VERSION,
  CANDIDATE_STATUS,
  EVIDENCE_SOURCE_TYPE,
  CONFIDENCE,
  buildCandidateIdentity,
  buildEvidenceProposal,
  transitionProposal,
  buildRecoveryReevaluationContract,
  sha256,
};
