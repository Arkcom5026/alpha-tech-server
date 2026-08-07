'use strict'

const fs = require('fs')
const dotenv = require('dotenv')
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority')

const parseBranchIds = (argv) => {
  const ids = []
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--branch') {
      ids.push(argv[index + 1])
      index += 1
    }
  }
  return ids
}

async function main() {
  if (!fs.existsSync('.env.restore')) {
    throw new Error('Missing .env.restore')
  }

  const restoreEnv = dotenv.parse(fs.readFileSync('.env.restore'))
  const recoveryUrl = restoreEnv.RESTORE_DATABASE_URL
  const authorityEnv = { ...process.env, ...restoreEnv }

  const authority = assertTestDatabaseAuthority({
    targetUrl: recoveryUrl,
    env: authorityEnv,
    requiresWriteApproval: true,
  })

  process.env.DATABASE_URL = recoveryUrl
  process.env.DIRECT_URL = recoveryUrl

  const { SystemDocumentPurposeTargetApplyService } = require('../src/modules/document-purpose/bootstrap/systemDocumentPurposeTargetApplyService')
  const service = new SystemDocumentPurposeTargetApplyService()
  const branchIds = parseBranchIds(process.argv.slice(2))
  const report = await service.execute({ branchIds })

  console.log(JSON.stringify({
    authority: {
      environment: 'TEST',
      target: authority.target,
    },
    report,
  }, null, 2))
}

main().catch((error) => {
  console.error('DOCUMENT_PURPOSE_SYSTEM_BOOTSTRAP_RECOVERY_APPLY_FAILED')
  console.error(error)
  process.exitCode = 1
})
