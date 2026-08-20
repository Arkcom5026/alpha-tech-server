'use strict'

require('dotenv').config()

const {
  SystemDocumentPurposeTargetApplyService,
} = require('../src/modules/document-purpose/bootstrap/systemDocumentPurposeTargetApplyService')

const CONFIRMATION = 'WRITE_SYSTEM_DOCUMENT_PURPOSES'

const parseArgs = (argv) => {
  const branchIds = []
  let confirmation = null

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--branch') {
      branchIds.push(argv[index + 1])
      index += 1
      continue
    }
    if (value === '--confirm') {
      confirmation = argv[index + 1]
      index += 1
    }
  }

  return { branchIds, confirmation }
}

const assertWriteIntent = ({ branchIds, confirmation }) => {
  if (!branchIds.length) {
    throw new Error('At least one explicit --branch target is required')
  }
  if (confirmation !== CONFIRMATION) {
    throw new Error(`Explicit --confirm ${CONFIRMATION} is required`)
  }
}

const databaseTarget = () => {
  const url = process.env.DATABASE_URL
  if (!url) return 'DATABASE_URL:not-set'
  try {
    const parsed = new URL(url)
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname}`
  } catch {
    return 'DATABASE_URL:invalid'
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  assertWriteIntent(args)

  const service = new SystemDocumentPurposeTargetApplyService()
  const report = await service.execute({ branchIds: args.branchIds })

  console.log(JSON.stringify({
    authority: {
      mode: 'CURRENT_DATABASE_EXPLICIT_TARGETS',
      target: databaseTarget(),
      confirmation: CONFIRMATION,
    },
    report,
  }, null, 2))
}

if (require.main === module) {
  main().catch((error) => {
    console.error('DOCUMENT_PURPOSE_SYSTEM_BOOTSTRAP_CURRENT_APPLY_FAILED')
    console.error(error)
    process.exitCode = 1
  })
}

module.exports = {
  CONFIRMATION,
  assertWriteIntent,
  parseArgs,
}
