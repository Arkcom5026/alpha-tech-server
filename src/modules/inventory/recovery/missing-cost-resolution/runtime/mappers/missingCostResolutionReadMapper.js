const { buildQueueResponseDto, buildDetailResponseDto } = require('../../contracts/missingCostResolutionDtoContract');

const toIso = (value) => (value instanceof Date ? value.toISOString() : value == null ? null : String(value));
const toNumber = (value) => (value == null ? null : Number(value));

const buildReadOnlyCapabilities = () => ({
  viewDetail: true,
  createProposal: false,
  submitProposal: false,
  reviewProposal: false,
  viewAuditHistory: true,
  executeInventoryRecovery: false,
});

const mapQueueRow = (row) => ({
  candidateId: row.candidateId,
  branchId: row.branchId,
  stockBalanceId: row.stockBalanceId,
  productId: row.productId,
  status: row.status,
  reasonCode: 'BLOCKED_MISSING_COST',
  quantity: toNumber(row.stockBalance?.quantity) || 0,
  currentCostEvidence: {
    avgCost: toNumber(row.stockBalance?.avgCost),
    lastReceivedCost: toNumber(row.stockBalance?.lastReceivedCost),
    hasDefensibleCost: Boolean(row.versions?.[0]?.proposedUnitCost != null),
  },
  movementSummary: {
    movementCount: 0,
    movementNetQuantity: 0,
    balanceQuantity: toNumber(row.stockBalance?.quantity) || 0,
    difference: 0,
  },
  sourceSnapshotHash: row.sourceSnapshotHash,
});

const mapVersion = (version) => ({
  id: version.id,
  version: version.version,
  sourceType: version.sourceType,
  sourceReference: version.sourceReference,
  evidenceSummary: version.evidenceSummary,
  proposedUnitCost: toNumber(version.proposedUnitCost),
  effectiveDate: toIso(version.effectiveDate),
  confidence: version.confidence,
  rationale: version.rationale,
  evidenceHash: version.evidenceHash,
  candidateSnapshotHash: version.candidateSnapshotHash,
  submittedAt: toIso(version.submittedAt),
  approvedAt: toIso(version.approvedAt),
  approvalSnapshot: version.approvalSnapshot ?? null,
  createdAt: toIso(version.createdAt),
});

const mapAuditEvent = (event) => ({
  eventId: String(event.id),
  previousStatus: event.previousStatus,
  resultingStatus: event.resultingStatus || event.previousStatus || 'DRAFT',
  actorIdentity: `employee:${event.actorEmployeeId}`,
  reasonCode: event.reasonCode,
  note: event.note,
  evidenceHash: event.evidenceHash,
  occurredAt: toIso(event.occurredAt),
});

const buildRuntimeQueueDto = ({ branchId, rows }) => {
  const candidates = rows.map(mapQueueRow);
  const dto = buildQueueResponseDto({
    branchId,
    queueId: `missing-cost-runtime-queue-${branchId}`,
    sourceSnapshotHash: candidates.map((item) => item.sourceSnapshotHash).sort().join(':') || `empty-${branchId}`,
    summary: {
      candidateCount: candidates.length,
      unresolvedCount: candidates.filter((item) => !['APPROVED', 'CANCELLED', 'SUPERSEDED'].includes(item.status)).length,
      draftCount: candidates.filter((item) => item.status === 'DRAFT').length,
      submittedCount: candidates.filter((item) => item.status === 'SUBMITTED').length,
      returnedCount: candidates.filter((item) => item.status === 'RETURNED_FOR_CORRECTION').length,
      rejectedCount: candidates.filter((item) => item.status === 'REJECTED').length,
    },
    candidates,
  });
  dto.capabilities = buildReadOnlyCapabilities();
  return dto;
};

const buildRuntimeDetailDto = (row) => {
  const candidate = {
    ...mapQueueRow(row),
    entryId: row.candidateEntryId,
    movementIds: [],
    movementEvidenceHash: row.sourceSnapshotHash,
    preconditionHash: row.candidateIdentityHash,
    staleDataContract: {
      auditId: row.sourceAuditId,
      auditSourceSnapshotHash: row.sourceSnapshotHash,
      candidateSourceSnapshotHash: row.sourceSnapshotHash,
    },
  };
  const resolution = {
    id: row.id,
    branchId: row.branchId,
    candidateId: row.candidateId,
    status: row.status,
    currentVersion: row.currentVersion,
    approvedAt: toIso(row.approvedAt),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    product: row.product,
    evidenceVersions: (row.versions || []).map(mapVersion),
  };
  const dto = buildDetailResponseDto({
    candidate,
    resolution,
    auditEvents: (row.events || []).map(mapAuditEvent),
  });
  dto.capabilities = {
    saveDraft: false,
    submit: false,
    approve: false,
    reject: false,
    returnForCorrection: false,
    cancel: false,
    viewRecoveryPreviewEligibility: true,
    executeInventoryRecovery: false,
  };
  return dto;
};

module.exports = {
  buildReadOnlyCapabilities,
  mapQueueRow,
  mapVersion,
  mapAuditEvent,
  buildRuntimeQueueDto,
  buildRuntimeDetailDto,
};
