const normalizeBranchIds = (values = []) =>
  [...new Set(values.map((value) => Number.parseInt(value, 10)).filter(Number.isFinite))].sort(
    (a, b) => a - b
  )

const resolveProductOwnershipEvidence = ({
  canonicalBranchId,
  requestedSourceBranchId,
  branchPriceBranchIds = [],
  stockItemBranchIds = [],
} = {}) => {
  const requested = Number.parseInt(requestedSourceBranchId, 10)
  const canonical = Number.parseInt(canonicalBranchId, 10)

  if (!Number.isFinite(requested) || requested <= 0) {
    return { status: 'INVALID_REQUESTED_BRANCH', branchId: null, evidenceBranchIds: [] }
  }

  if (Number.isFinite(canonical) && canonical > 0) {
    return canonical === requested
      ? {
          status: 'CANONICAL',
          branchId: canonical,
          evidenceBranchIds: [canonical],
        }
      : {
          status: 'CANONICAL_MISMATCH',
          branchId: canonical,
          evidenceBranchIds: [canonical],
        }
  }

  const evidenceBranchIds = normalizeBranchIds([
    ...branchPriceBranchIds,
    ...stockItemBranchIds,
  ])

  if (evidenceBranchIds.length === 0) {
    return { status: 'NO_EVIDENCE', branchId: null, evidenceBranchIds }
  }

  if (evidenceBranchIds.length > 1) {
    return { status: 'CROSS_BRANCH_CONFLICT', branchId: null, evidenceBranchIds }
  }

  const inferredBranchId = evidenceBranchIds[0]
  return inferredBranchId === requested
    ? {
        status: 'SINGLE_BRANCH_EVIDENCE',
        branchId: inferredBranchId,
        evidenceBranchIds,
      }
    : {
        status: 'EVIDENCE_MISMATCH',
        branchId: inferredBranchId,
        evidenceBranchIds,
      }
}

module.exports = {
  normalizeBranchIds,
  resolveProductOwnershipEvidence,
}
