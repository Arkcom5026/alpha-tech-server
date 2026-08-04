const assert = require('assert')
const {
  normalizeBranchIds,
  resolveProductOwnershipEvidence,
} = require('../src/modules/productTemplate/candidates/create/resolveProductOwnershipEvidence')

const run = () => {
  assert.deepStrictEqual(normalizeBranchIds([2, '2', 1, null, undefined, 'x']), [1, 2])

  assert.deepStrictEqual(
    resolveProductOwnershipEvidence({
      canonicalBranchId: 2,
      requestedSourceBranchId: 2,
      branchPriceBranchIds: [1],
      stockItemBranchIds: [3],
    }),
    { status: 'CANONICAL', branchId: 2, evidenceBranchIds: [2] }
  )

  assert.deepStrictEqual(
    resolveProductOwnershipEvidence({
      canonicalBranchId: 2,
      requestedSourceBranchId: 1,
    }),
    { status: 'CANONICAL_MISMATCH', branchId: 2, evidenceBranchIds: [2] }
  )

  assert.deepStrictEqual(
    resolveProductOwnershipEvidence({
      canonicalBranchId: null,
      requestedSourceBranchId: 2,
      branchPriceBranchIds: [2, 2],
      stockItemBranchIds: [2],
    }),
    { status: 'SINGLE_BRANCH_EVIDENCE', branchId: 2, evidenceBranchIds: [2] }
  )

  assert.deepStrictEqual(
    resolveProductOwnershipEvidence({
      canonicalBranchId: null,
      requestedSourceBranchId: 1,
      branchPriceBranchIds: [2],
      stockItemBranchIds: [],
    }),
    { status: 'EVIDENCE_MISMATCH', branchId: 2, evidenceBranchIds: [2] }
  )

  assert.deepStrictEqual(
    resolveProductOwnershipEvidence({
      canonicalBranchId: null,
      requestedSourceBranchId: 2,
      branchPriceBranchIds: [2],
      stockItemBranchIds: [1],
    }),
    { status: 'CROSS_BRANCH_CONFLICT', branchId: null, evidenceBranchIds: [1, 2] }
  )

  assert.deepStrictEqual(
    resolveProductOwnershipEvidence({
      canonicalBranchId: null,
      requestedSourceBranchId: 2,
    }),
    { status: 'NO_EVIDENCE', branchId: null, evidenceBranchIds: [] }
  )

  assert.deepStrictEqual(
    resolveProductOwnershipEvidence({
      canonicalBranchId: null,
      requestedSourceBranchId: null,
      branchPriceBranchIds: [2],
    }),
    { status: 'INVALID_REQUESTED_BRANCH', branchId: null, evidenceBranchIds: [] }
  )

  console.log('product-template-candidate ownership resolver contract: PASS')
}

run()
