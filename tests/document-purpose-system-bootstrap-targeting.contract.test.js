'use strict'

const assert = require('assert/strict')
const {
  assertExplicitBootstrapTargets,
  normalizeBranchIds,
} = require('../src/modules/document-purpose/bootstrap/systemDocumentPurposeTargetPolicy')
const {
  SystemDocumentPurposeTargetReadinessService,
} = require('../src/modules/document-purpose/bootstrap/systemDocumentPurposeTargetReadinessService')

assert.deepEqual(normalizeBranchIds(['14', 2, 2, 5]), [2, 5, 14])
assert.throws(
  () => normalizeBranchIds([]),
  (error) => error.code === 'DOCUMENT_PURPOSE_BOOTSTRAP_TARGET_INVALID',
)

const operationalBranches = [
  { id: 2, name: 'A', features: null },
  { id: 5, name: 'B', features: null },
]
assert.deepEqual(
  assertExplicitBootstrapTargets({ requestedBranchIds: [5, 2], branches: operationalBranches }).map((row) => row.id),
  [2, 5],
)

assert.throws(
  () => assertExplicitBootstrapTargets({
    requestedBranchIds: [1],
    branches: [{ id: 1, name: 'Template', features: { template: true } }],
  }),
  (error) => error.code === 'DOCUMENT_PURPOSE_BOOTSTRAP_TEMPLATE_FORBIDDEN',
)

assert.throws(
  () => assertExplicitBootstrapTargets({ requestedBranchIds: [9], branches: [] }),
  (error) => error.code === 'DOCUMENT_PURPOSE_BOOTSTRAP_TARGET_NOT_FOUND',
)

const repository = {
  async findBranchesByIds(ids) {
    assert.deepEqual(ids, [2, 5, 14])
    return [
      { id: 2, name: 'Store 2', features: null },
      { id: 5, name: 'Store 5', features: null },
      { id: 14, name: 'Store 14', features: null },
    ]
  },
}

const readinessService = {
  async inspectBranch(branch) {
    return {
      branchId: branch.id,
      branchName: branch.name,
      ready: true,
      missing: ['SALE_RECEIPT', 'DELIVERY_NOTE', 'SHORT_TAX_INVOICE', 'FULL_TAX_INVOICE'],
      existing: [],
      conflicts: [],
      drift: [],
    }
  },
}

;(async () => {
  const service = new SystemDocumentPurposeTargetReadinessService(repository, readinessService)
  const report = await service.execute({ branchIds: [14, 2, 5] })

  assert.equal(report.mode, 'READ_ONLY_EXPLICIT_TARGETS')
  assert.equal(report.ready, true)
  assert.deepEqual(report.branchIds, [2, 5, 14])
  assert.equal(report.branchCount, 3)
  assert.equal(report.totals.missing, 12)
  assert.equal(report.totals.conflicts, 0)
  assert.equal(report.totals.drift, 0)

  console.log('document-purpose-system-bootstrap-targeting.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
