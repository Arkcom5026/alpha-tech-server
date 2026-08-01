const assert = require('node:assert/strict');
const {
  MissingCostResolutionMutationService,
} = require('../src/modules/inventory/recovery/missing-cost-resolution/runtime/service/missingCostResolutionMutationService');

const calls = [];
const repository = {
  async createDraft(input) {
    calls.push(['createDraft', input]);
    return { id: 41, candidateId: input.candidateId, status: 'DRAFT', currentVersion: 1 };
  },
  async appendEvidenceVersion(input) {
    calls.push(['appendEvidenceVersion', input]);
    return {
      resolutionId: input.resolutionId,
      currentVersion: 2,
      version: { version: 2, evidenceHash: input.evidenceHash },
    };
  },
  async transition(input) {
    calls.push(['transition', input]);
    return {
      resolutionId: input.resolutionId,
      previousStatus: input.expectedStatus,
      status: input.toStatus,
      currentVersion: input.expectedVersion,
      event: { id: 77 },
    };
  },
};

(async () => {
  const service = new MissingCostResolutionMutationService(repository);

  const draft = await service.createDraft({
    branchId: 7,
    employeeId: 12,
    input: {
      stockBalanceId: 33,
      productId: 44,
      sourceAuditId: 'audit-1',
      sourceSnapshotHash: 'snapshot-1',
      candidateEntryId: 'entry-1',
    },
  });
  assert.equal(draft.branchId, 7);
  assert.equal(draft.status, 'DRAFT');
  assert.equal(draft.inventoryMutationPerformed, false);
  assert.equal(calls[0][1].branchId, 7);
  assert.equal(calls[0][1].actorEmployeeId, 12);

  const evidence = await service.appendEvidence({
    branchId: 7,
    employeeId: 12,
    resolutionId: 41,
    input: {
      expectedStatus: 'DRAFT',
      expectedVersion: 1,
      expectedSnapshotHash: 'snapshot-1',
      stockBalanceId: 33,
      productId: 44,
      sourceType: 'SUPPLIER_DOCUMENT',
      sourceReference: 'INV-001',
      evidenceSummary: 'Supplier invoice evidence',
      proposedUnitCost: 1500,
      effectiveDate: '2026-08-01T00:00:00.000Z',
      confidence: 'HIGH',
      rationale: 'Matches supplier document',
    },
  });
  assert.equal(evidence.currentVersion, 2);
  assert.equal(evidence.inventoryMutationPerformed, false);
  assert.equal(calls[1][1].expectedStatus, 'DRAFT');
  assert.equal(calls[1][1].expectedVersion, 1);
  assert.ok(calls[1][1].evidenceHash);

  const submitted = await service.transition({
    branchId: 7,
    employeeId: 12,
    resolutionId: 41,
    input: {
      expectedStatus: 'DRAFT',
      expectedVersion: 2,
      expectedSnapshotHash: 'snapshot-1',
      expectedEvidenceHash: calls[1][1].evidenceHash,
      toStatus: 'SUBMITTED',
      reasonCode: 'READY_FOR_REVIEW',
      proposerEmployeeId: 12,
    },
  });
  assert.equal(submitted.status, 'SUBMITTED');
  assert.equal(submitted.inventoryMutationPerformed, false);
  assert.equal(calls[2][1].toStatus, 'SUBMITTED');

  await assert.rejects(
    () => service.transition({
      branchId: 7,
      employeeId: 12,
      resolutionId: 41,
      input: {
        expectedStatus: 'SUBMITTED',
        expectedVersion: 2,
        expectedSnapshotHash: 'snapshot-1',
        expectedEvidenceHash: calls[1][1].evidenceHash,
        toStatus: 'APPROVED',
        reasonCode: 'APPROVE_COST',
        proposerEmployeeId: 12,
      },
    }),
    (error) => error.code === 'MISSING_COST_RESOLUTION_SELF_APPROVAL_FORBIDDEN',
  );

  assert.equal(calls.length, 3, 'self-approval must fail before repository mutation');
  console.log('Missing Cost Resolution mutation service contract: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
