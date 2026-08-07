'use strict'

const { SystemDocumentPurposeBootstrapService } = require('./systemDocumentPurposeBootstrapService')
const { SystemDocumentPurposeBootstrapRepository } = require('./systemDocumentPurposeBootstrapRepository')
const { assertExplicitBootstrapTargets } = require('./systemDocumentPurposeTargetPolicy')

class SystemDocumentPurposeTargetApplyService {
  constructor({ repository, bootstrapService } = {}) {
    this.repository = repository || new SystemDocumentPurposeBootstrapRepository()
    this.bootstrapService = bootstrapService || new SystemDocumentPurposeBootstrapService(this.repository)
  }

  async execute({ branchIds, actorEmployeeId = null } = {}) {
    const branches = await this.repository.listBranches()
    const selected = assertExplicitBootstrapTargets({
      requestedBranchIds: branchIds,
      branches,
    })

    const results = []
    for (const branch of selected) {
      const result = await this.bootstrapService.execute({
        branchId: branch.id,
        actorEmployeeId,
      })
      results.push({
        branchId: branch.id,
        branchName: branch.name ?? null,
        changed: result.changed,
        createdCount: result.created.length,
        existingCount: result.existing.length,
      })
    }

    return {
      mode: 'WRITE_EXPLICIT_TARGETS',
      branchCount: selected.length,
      branchIds: selected.map((branch) => branch.id),
      changedBranchCount: results.filter((result) => result.changed).length,
      createdDefinitionCount: results.reduce((total, result) => total + result.createdCount, 0),
      existingDefinitionCount: results.reduce((total, result) => total + result.existingCount, 0),
      branches: results,
    }
  }
}

module.exports = {
  SystemDocumentPurposeTargetApplyService,
}
