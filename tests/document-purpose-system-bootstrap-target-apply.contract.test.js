'use strict'

const assert = require('assert')
const { SystemDocumentPurposeTargetApplyService } = require('../src/modules/document-purpose/bootstrap/systemDocumentPurposeTargetApplyService')

;(async () => {
  const repository = {
    async listBranches() {
      return [
        { id: 1, name: 'Template', features: { template: true } },
        { id: 2, name: 'Store A', features: null },
        { id: 5, name: 'Store B', features: null },
      ]
    },
  }

  const calls = []
  const bootstrapService = {
    async execute({ branchId, actorEmployeeId }) {
      calls.push({ branchId, actorEmployeeId })
      return {
        changed: true,
        created: [{}, {}, {}, {}],
        existing: [],
      }
    },
  }

  const service = new SystemDocumentPurposeTargetApplyService({ repository, bootstrapService })
  const report = await service.execute({ branchIds: [5, 2, 5] })

  assert.deepStrictEqual(report.branchIds, [2, 5])
  assert.strictEqual(report.branchCount, 2)
  assert.strictEqual(report.changedBranchCount, 2)
  assert.strictEqual(report.createdDefinitionCount, 8)
  assert.strictEqual(report.existingDefinitionCount, 0)
  assert.deepStrictEqual(calls.map((call) => call.branchId), [2, 5])

  await assert.rejects(
    () => service.execute({ branchIds: [1] }),
    (error) => error.code === 'DOCUMENT_PURPOSE_BOOTSTRAP_TEMPLATE_FORBIDDEN',
  )

  console.log('document-purpose-system-bootstrap-target-apply.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
