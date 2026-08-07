'use strict'

const targetError = (code, message, detail) => {
  const error = new Error(message)
  error.code = code
  if (detail !== undefined) error.detail = detail
  return error
}

const normalizeBranchIds = (values) => {
  const raw = Array.isArray(values) ? values : [values]
  const ids = raw
    .filter((value) => value != null && value !== '')
    .map((value) => Number(value))

  if (ids.length === 0 || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw targetError(
      'DOCUMENT_PURPOSE_BOOTSTRAP_TARGET_INVALID',
      'At least one explicit positive branch id is required',
    )
  }

  return [...new Set(ids)].sort((a, b) => a - b)
}

const isTemplateBranch = (branch) => branch?.features?.template === true

const assertExplicitBootstrapTargets = ({ requestedBranchIds, branches }) => {
  const ids = normalizeBranchIds(requestedBranchIds)
  const byId = new Map(branches.map((branch) => [Number(branch.id), branch]))
  const missingIds = ids.filter((id) => !byId.has(id))

  if (missingIds.length > 0) {
    throw targetError(
      'DOCUMENT_PURPOSE_BOOTSTRAP_TARGET_NOT_FOUND',
      'One or more requested branches do not exist',
      { branchIds: missingIds },
    )
  }

  const selected = ids.map((id) => byId.get(id))
  const templateBranches = selected.filter(isTemplateBranch)

  if (templateBranches.length > 0) {
    throw targetError(
      'DOCUMENT_PURPOSE_BOOTSTRAP_TEMPLATE_FORBIDDEN',
      'Template branches are not eligible for operational system document purpose bootstrap',
      {
        branches: templateBranches.map((branch) => ({ id: branch.id, name: branch.name ?? null })),
      },
    )
  }

  return selected
}

module.exports = {
  assertExplicitBootstrapTargets,
  isTemplateBranch,
  normalizeBranchIds,
}
