const assert = require('assert');
const {
  assertExpectedAuthority,
  assertSeparateApprover,
  assertTransitionEventType,
} = require('../src/modules/inventory/recovery/missing-cost-resolution/runtime/policy/missingCostResolutionMutationPolicy');
const {
  MissingCostResolutionMutationRepository,
} = require('../src/modules/inventory/recovery/missing-cost-resolution/runtime/repository/missingCostResolutionMutationRepository');

assert.doesNotThrow(() => assertExpectedAuthority({
  resolution: {
    branchId: 7,
    status: 'DRAFT',
    currentVersion: 2,
    sourceSnapshotHash: 'snapshot-1',
  },
  branchId: 7,
  expectedStatus: 'DRAFT',
  expectedVersion: 2,
  expectedSnapshotHash: 'snapshot-1',
}));

assert.throws(() => assertExpectedAuthority({
  resolution: { branchId: 8, status: 'DRAFT', currentVersion: 2, sourceSnapshotHash: 'snapshot-1' },
  branchId: 7,
}), (error) => error.code === 'MISSING_COST_RESOLUTION_NOT_FOUND' && error.statusCode === 404);

assert.throws(() => assertExpectedAuthority({
  resolution: { branchId: 7, status: 'SUBMITTED', currentVersion: 3, sourceSnapshotHash: 'snapshot-2' },
  branchId: 7,
  expectedStatus: 'DRAFT',
  expectedVersion: 2,
  expectedSnapshotHash: 'snapshot-1',
}), (error) => error.code === 'MISSING_COST_RESOLUTION_STALE_STATUS' && error.statusCode === 409);

assert.throws(() => assertSeparateApprover({
  resolution: { createdByEmployeeId: 41 },
  actorEmployeeId: 41,
  toStatus: 'APPROVED',
}), (error) => error.code === 'MISSING_COST_RESOLUTION_SELF_APPROVAL_FORBIDDEN');

assert.strictEqual(assertTransitionEventType('APPROVED'), 'APPROVED');
assert.throws(() => assertTransitionEventType('UNKNOWN'), (error) => error.code === 'MISSING_COST_RESOLUTION_INVALID_TRANSITION');

const calls = [];
const tx = {
  stockBalance: {
    findFirst: async (args) => {
      calls.push(['stockBalance.findFirst', args]);
      return { id: 5 };
    },
  },
  missingCostResolution: {
    create: async (args) => {
      calls.push(['missingCostResolution.create', args]);
      return { id: 11, ...args.data };
    },
    findFirst: async (args) => {
      calls.push(['missingCostResolution.findFirst', args]);
      return {
        id: 11,
        branchId: 7,
        status: 'DRAFT',
        currentVersion: 1,
        sourceSnapshotHash: 'snapshot-1',
        createdByEmployeeId: 40,
        versions: [{ id: 21, evidenceHash: 'evidence-1' }],
      };
    },
    updateMany: async (args) => {
      calls.push(['missingCostResolution.updateMany', args]);
      return { count: 1 };
    },
  },
  missingCostResolutionVersion: {
    create: async (args) => {
      calls.push(['missingCostResolutionVersion.create', args]);
      return { id: 21, ...args.data };
    },
    update: async (args) => {
      calls.push(['missingCostResolutionVersion.update', args]);
      return args.data;
    },
  },
  missingCostResolutionEvent: {
    create: async (args) => {
      calls.push(['missingCostResolutionEvent.create', args]);
      return { id: 31, ...args.data };
    },
  },
};
const client = { $transaction: async (work) => work(tx) };
const repository = new MissingCostResolutionMutationRepository(client);

(async () => {
  const draft = await repository.createDraft({
    branchId: 7,
    stockBalanceId: 5,
    productId: 9,
    sourceAuditId: 'audit-1',
    sourceSnapshotHash: 'snapshot-1',
    candidateId: 'candidate-1',
    candidateIdentityHash: 'identity-1',
    candidateEntryId: 'entry-1',
    actorEmployeeId: 40,
  });
  assert.strictEqual(draft.status, 'DRAFT');
  assert.strictEqual(calls[0][1].where.branchId, 7);
  assert.strictEqual(calls[0][1].where.productId, 9);

  const versionResult = await repository.appendEvidenceVersion({
    branchId: 7,
    resolutionId: 11,
    expectedStatus: 'DRAFT',
    expectedVersion: 1,
    expectedSnapshotHash: 'snapshot-1',
    actorEmployeeId: 40,
    sourceType: 'SUPPLIER_DOCUMENT',
    sourceReference: 'INV-001',
    evidenceSummary: 'Supplier invoice',
    proposedUnitCost: 125,
    effectiveDate: '2026-08-01T00:00:00.000Z',
    confidence: 'HIGH',
    rationale: 'Verified supplier document',
    evidenceHash: 'evidence-1',
  });
  assert.strictEqual(versionResult.currentVersion, 2);
  const versionUpdate = calls.find(([name]) => name === 'missingCostResolution.updateMany');
  assert.strictEqual(versionUpdate[1].where.branchId, 7);
  assert.strictEqual(versionUpdate[1].where.currentVersion, 1);

  calls.length = 0;
  const transitionResult = await repository.transition({
    branchId: 7,
    resolutionId: 11,
    actorEmployeeId: 42,
    expectedStatus: 'DRAFT',
    expectedVersion: 1,
    expectedSnapshotHash: 'snapshot-1',
    expectedEvidenceHash: 'evidence-1',
    toStatus: 'SUBMITTED',
    reasonCode: 'READY_FOR_REVIEW',
  });
  assert.strictEqual(transitionResult.status, 'SUBMITTED');
  const transitionUpdate = calls.find(([name]) => name === 'missingCostResolution.updateMany');
  assert.deepStrictEqual(transitionUpdate[1].where, {
    id: 11,
    branchId: 7,
    status: 'DRAFT',
    currentVersion: 1,
  });
  assert(calls.some(([name, args]) => name === 'missingCostResolutionEvent.create' && args.data.eventType === 'SUBMITTED'));
  assert(!calls.some(([name]) => ['simpleLot.create', 'stockMovement.create', 'stockBalance.update'].includes(name)));

  console.log('Missing Cost Resolution mutation repository foundation contract: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
