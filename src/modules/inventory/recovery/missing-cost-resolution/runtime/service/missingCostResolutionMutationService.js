const repository = require('../repository/missingCostResolutionMutationRepository');
const {
  buildCandidateIdentity,
  buildEvidenceProposal,
  transitionProposal,
  CANDIDATE_STATUS,
} = require('../../contracts/missingCostResolutionContract');
const {
  assertBranchId,
  assertResolutionId,
  createNotFoundError,
} = require('./missingCostResolutionReadService');

const assertEmployeeId = (employeeId) => {
  const value = Number(employeeId);
  if (!Number.isInteger(value) || value <= 0) {
    const error = new Error('Authenticated employee is required');
    error.code = 'MISSING_COST_EMPLOYEE_REQUIRED';
    error.statusCode = 403;
    throw error;
  }
  return value;
};

const assertExpectedVersion = (version) => {
  const value = Number(version);
  if (!Number.isInteger(value) || value <= 0) {
    const error = new Error('Expected version must be a positive integer');
    error.code = 'MISSING_COST_RESOLUTION_EXPECTED_VERSION_INVALID';
    error.statusCode = 400;
    throw error;
  }
  return value;
};

const assertExpectedStatus = (status) => {
  const value = String(status || '').trim();
  if (!Object.values(CANDIDATE_STATUS).includes(value)) {
    const error = new Error('Expected status is invalid');
    error.code = 'MISSING_COST_RESOLUTION_EXPECTED_STATUS_INVALID';
    error.statusCode = 400;
    throw error;
  }
  return value;
};

const assertRequiredText = (value, fieldName) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    const error = new Error(`${fieldName} is required`);
    error.code = 'MISSING_COST_RESOLUTION_REQUIRED_FIELD';
    error.statusCode = 400;
    error.details = { fieldName };
    throw error;
  }
  return normalized;
};

class MissingCostResolutionMutationService {
  constructor(mutationRepository = repository) {
    this.repository = mutationRepository;
  }

  async createDraft({ branchId, employeeId, input }) {
    const scopedBranchId = assertBranchId(branchId);
    const actorEmployeeId = assertEmployeeId(employeeId);
    const candidate = buildCandidateIdentity({
      branchId: scopedBranchId,
      stockBalanceId: input.stockBalanceId,
      productId: input.productId,
      sourceSnapshotHash: input.sourceSnapshotHash,
    });

    const created = await this.repository.createDraft({
      branchId: scopedBranchId,
      stockBalanceId: candidate.stockBalanceId,
      productId: candidate.productId,
      sourceAuditId: assertRequiredText(input.sourceAuditId, 'sourceAuditId'),
      sourceSnapshotHash: candidate.sourceSnapshotHash,
      candidateId: candidate.candidateId,
      candidateIdentityHash: candidate.candidateIdentityHash,
      candidateEntryId: assertRequiredText(input.candidateEntryId, 'candidateEntryId'),
      actorEmployeeId,
    });
    if (!created) throw createNotFoundError();

    return {
      apiVersion: 'missing-cost-resolution-api-v1',
      operation: 'CREATE_DRAFT',
      resolutionId: created.id,
      branchId: scopedBranchId,
      candidateId: created.candidateId,
      status: created.status,
      currentVersion: created.currentVersion,
      inventoryMutationPerformed: false,
    };
  }

  async appendEvidence({ branchId, employeeId, resolutionId, input }) {
    const scopedBranchId = assertBranchId(branchId);
    const actorEmployeeId = assertEmployeeId(employeeId);
    const scopedResolutionId = assertResolutionId(resolutionId);
    const expectedStatus = assertExpectedStatus(input.expectedStatus);
    const expectedVersion = assertExpectedVersion(input.expectedVersion);

    const proposal = buildEvidenceProposal({
      candidate: {
        branchId: scopedBranchId,
        stockBalanceId: input.stockBalanceId,
        productId: input.productId,
        sourceSnapshotHash: input.expectedSnapshotHash,
      },
      sourceType: input.sourceType,
      sourceReference: input.sourceReference,
      evidenceSummary: input.evidenceSummary,
      proposedUnitCost: input.proposedUnitCost,
      effectiveDate: input.effectiveDate,
      confidence: input.confidence,
      proposerIdentity: `employee:${actorEmployeeId}`,
      rationale: input.rationale,
    });

    const result = await this.repository.appendEvidenceVersion({
      branchId: scopedBranchId,
      resolutionId: scopedResolutionId,
      expectedStatus,
      expectedVersion,
      expectedSnapshotHash: proposal.sourceSnapshotHash,
      actorEmployeeId,
      sourceType: proposal.sourceType,
      sourceReference: proposal.sourceReference,
      evidenceSummary: proposal.evidenceSummary,
      proposedUnitCost: proposal.proposedUnitCost,
      effectiveDate: proposal.effectiveDate,
      confidence: proposal.confidence,
      rationale: proposal.rationale,
      evidenceHash: proposal.evidenceHash,
    });

    return {
      apiVersion: 'missing-cost-resolution-api-v1',
      operation: 'APPEND_EVIDENCE_VERSION',
      resolutionId: result.resolutionId,
      currentVersion: result.currentVersion,
      evidenceVersion: result.version.version,
      evidenceHash: result.version.evidenceHash,
      inventoryMutationPerformed: false,
    };
  }

  async transition({ branchId, employeeId, resolutionId, input }) {
    const scopedBranchId = assertBranchId(branchId);
    const actorEmployeeId = assertEmployeeId(employeeId);
    const scopedResolutionId = assertResolutionId(resolutionId);
    const expectedStatus = assertExpectedStatus(input.expectedStatus);
    const expectedVersion = assertExpectedVersion(input.expectedVersion);
    const toStatus = assertExpectedStatus(input.toStatus);

    transitionProposal({
      proposal: {
        branchId: scopedBranchId,
        status: expectedStatus,
        evidenceHash: input.expectedEvidenceHash,
        proposerIdentity: input.proposerEmployeeId ? `employee:${Number(input.proposerEmployeeId)}` : null,
        candidateId: input.candidateId || `resolution:${scopedResolutionId}`,
        proposalId: input.proposalId || `resolution:${scopedResolutionId}:v${expectedVersion}`,
      },
      toStatus,
      actorIdentity: `employee:${actorEmployeeId}`,
      actorBranchId: scopedBranchId,
      reason: assertRequiredText(input.reasonCode, 'reasonCode'),
      expectedEvidenceHash: input.expectedEvidenceHash,
      enforceSeparateApprover: toStatus === CANDIDATE_STATUS.APPROVED,
    });

    const result = await this.repository.transition({
      branchId: scopedBranchId,
      resolutionId: scopedResolutionId,
      actorEmployeeId,
      expectedStatus,
      expectedVersion,
      expectedSnapshotHash: assertRequiredText(input.expectedSnapshotHash, 'expectedSnapshotHash'),
      expectedEvidenceHash: input.expectedEvidenceHash
        ? assertRequiredText(input.expectedEvidenceHash, 'expectedEvidenceHash')
        : undefined,
      toStatus,
      reasonCode: assertRequiredText(input.reasonCode, 'reasonCode'),
      note: input.note == null ? null : String(input.note).trim() || null,
      approvalSnapshot: toStatus === CANDIDATE_STATUS.APPROVED
        ? {
          approvedEvidenceHash: assertRequiredText(input.expectedEvidenceHash, 'expectedEvidenceHash'),
          expectedVersion,
          expectedSnapshotHash: input.expectedSnapshotHash,
          approvedByEmployeeId: actorEmployeeId,
        }
        : null,
    });

    return {
      apiVersion: 'missing-cost-resolution-api-v1',
      operation: 'TRANSITION',
      resolutionId: result.resolutionId,
      previousStatus: result.previousStatus,
      status: result.status,
      currentVersion: result.currentVersion,
      eventId: result.event.id,
      inventoryMutationPerformed: false,
    };
  }
}

module.exports = new MissingCostResolutionMutationService();
module.exports.MissingCostResolutionMutationService = MissingCostResolutionMutationService;
module.exports.assertEmployeeId = assertEmployeeId;
module.exports.assertExpectedVersion = assertExpectedVersion;
module.exports.assertExpectedStatus = assertExpectedStatus;
module.exports.assertRequiredText = assertRequiredText;
