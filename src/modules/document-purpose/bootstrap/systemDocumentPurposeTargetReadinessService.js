'use strict'

const { SystemDocumentPurposeBootstrapRepository } = require('./systemDocumentPurposeBootstrapRepository')
const { SystemDocumentPurposeReadinessService } = require('./systemDocumentPurposeReadinessService')
const { assertExplicitBootstrapTargets, normalizeBranchIds } = require('./systemDocumentPurposeTargetPolicy')

class SystemDocumentPurposeTargetReadinessService {
  constructor(
    repository = new SystemDocumentPurposeBootstrapRepository(),
    readinessService = new SystemDocumentPurposeReadinessService(repository),
  ) {
    this.repository = repository
    this.readinessService = readinessService
  }

  async execute({ branchIds } = {}) {
    const normalizedBranchIds = normalizeBranchIds(branchIds)
    const rows = await this.repository.findBranchesByIds(normalizedBranchIds)
    const branches = assertExplicitBootstrapTargets({
      requestedBranchIds: normalizedBranchIds,
      branches: rows,
    })

    const results = []
    for (const branch of branches) {
      results.push(await this.readinessService.inspectBranch(branch))
    }

    return {
      mode: 'READ_ONLY_EXPLICIT_TARGETS',
      branchCount: branches.length,
      ready: results.every((result) => result.ready),
      branchIds: branches.map((branch) => branch.id),
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
  SystemDocumentPurposeTargetReadinessService,
}
