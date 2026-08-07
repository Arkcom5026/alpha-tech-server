'use strict'

const { SystemDocumentPurposeReadinessService } = require('../src/modules/document-purpose/bootstrap/systemDocumentPurposeReadinessService')

async function main() {
  const service = new SystemDocumentPurposeReadinessService()
  const report = await service.execute()

  console.log(JSON.stringify(report, null, 2))

  if (!report.ready) {
    process.exitCode = 2
  }
}

main().catch((error) => {
  console.error('DOCUMENT_PURPOSE_SYSTEM_BOOTSTRAP_READINESS_FAILED')
  console.error(error)
  process.exitCode = 1
})
