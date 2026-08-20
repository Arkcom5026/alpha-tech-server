'use strict'

const { normalizeDocumentPurposeCode } = require('../shared/documentPurposeDomain')
const { SYSTEM_DOCUMENT_PURPOSES } = require('./systemDocumentPurposeCatalog')
const { isEquivalentSystemDefinition } = require('./systemDocumentPurposeBootstrapService')
const { SystemDocumentPurposeBootstrapRepository } = require('./systemDocumentPurposeBootstrapRepository')

const expectedProjection = (purpose) => ({
  code: purpose.code,
  normalizedCode: normalizeDocumentPurposeCode(purpose.code),
  displayName: purpose.displayName,
  description: purpose.description ?? null,
  categoryCode: purpose.categoryCode ?? null,
  isSystem: true,
  lifecycleState: 'ACTIVE',
  sortOrder: purpose.sortOrder ?? 0,
  metadata: purpose.metadata ?? null,
})

const classifyReadinessScope = (branch) => {
  if (branch?.features && typeof branch.features === 'object' && branch.features.template === true) {
    return Object.freeze({ included: false, reason: 'TEMPLATE_BRANCH' })
  }

  const partnerApplications = Array.isArray(branch?.provisionedPartnerStoreApplications)
    ? branch.provisionedPartnerStoreApplications
    : []
  if (partnerApplications.length > 0) {
    const provisioned = partnerApplications.some((application) => application?.provisioningStatus === 'PROVISIONED')
    if (!provisioned) {
      return Object.freeze({ included: false, reason: 'PARTNER_STORE_NOT_PROVISIONED' })
    }
  }

  return Object.freeze({ included: true, reason: null })
}

class SystemDocumentPurposeReadinessService {
  constructor(repository = new SystemDocumentPurposeBootstrapRepository()) {
    this.repository = repository
  }

  async inspectBranch(branch) {
    const catalog = SYSTEM_DOCUMENT_PURPOSES.map(expectedProjection)
    const existingRows = await this.repository.findByNormalizedCodes(
      branch.id,
      catalog.map((purpose) => purpose.normalizedCode),
    )
    const existingByCode = new Map(existingRows.map((row) => [row.normalizedCode, row]))

    const result = {
      branchId: branch.id,
      branchName: branch.name ?? null,
      ready: true,
      missing: [],
      existing: [],
      conflicts: [],
      drift: [],
    }

    for (const expected of catalog) {
      const current = existingByCode.get(expected.normalizedCode)
      if (!current) {
        result.ready = false
        result.missing.push(expected.code)
        continue
      }

      if (!current.isSystem) {
        result.ready = false
        result.conflicts.push({
          code: expected.code,
          definitionId: current.id,
          reason: 'CUSTOM_OWNS_RESERVED_CODE',
        })
        continue
      }

      if (!isEquivalentSystemDefinition(current, expected)) {
        result.ready = false
        result.drift.push({
          code: expected.code,
          definitionId: current.id,
          reason: 'SYSTEM_DEFINITION_DRIFT',
        })
        continue
      }

      result.existing.push(expected.code)
    }

    return result
  }

  async execute() {
    const discoveredBranches = await this.repository.listBranches()
    const branches = []
    const excludedBranches = []

    for (const branch of discoveredBranches) {
      const scope = classifyReadinessScope(branch)
      if (!scope.included) {
        excludedBranches.push({
          branchId: branch.id,
          branchName: branch.name ?? null,
          reason: scope.reason,
        })
        continue
      }
      branches.push(branch)
    }

    const results = []
    for (const branch of branches) {
      results.push(await this.inspectBranch(branch))
    }

    return {
      mode: 'READ_ONLY',
      catalogSize: SYSTEM_DOCUMENT_PURPOSES.length,
      discoveredBranchCount: discoveredBranches.length,
      branchCount: branches.length,
      excludedBranchCount: excludedBranches.length,
      excludedBranches,
      ready: results.every((result) => result.ready),
      branches: results,
      totals: results.reduce(
        (totals, result) => ({
          missing: totals.missing + result.missing.length,
          existing: totals.existing + result.existing.length,
          conflicts: totals.conflicts + result.conflicts.length,
          drift: totals.drift + result.drift.length,
        }),
        { missing: 0, existing: 0, conflicts: 0, drift: 0 },
      ),
    }
  }
}

module.exports = {
  SystemDocumentPurposeReadinessService,
  classifyReadinessScope,
  expectedProjection,
}
