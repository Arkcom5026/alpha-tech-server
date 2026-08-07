'use strict'

const { SystemDocumentPurposeTargetReadinessService } = require('../src/modules/document-purpose/bootstrap/systemDocumentPurposeTargetReadinessService')

const parseBranchIds = (argv) => {
  const branchIds = []

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] !== '--branch') continue
    branchIds.push(argv[i + 1])
    i += 1
  }

  return branchIds
}

async function main() {
  const branchIds = parseBranchIds(process.argv.slice(2))
  const service = new SystemDocumentPurposeTargetReadinessService()
  const report = await service.execute({ branchIds })

  console.log(JSON.stringify(report, null, 2))

  if (!report.ready) {
    process.exitCode = 2
  }
}

main().catch((error) => {
  console.error('DOCUMENT_PURPOSE_SYSTEM_BOOTSTRAP_TARGET_READINESS_FAILED')
  console.error(error)
  process.exitCode = 1
})
