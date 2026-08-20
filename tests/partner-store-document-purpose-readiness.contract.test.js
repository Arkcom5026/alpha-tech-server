'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const runtime = read('src/modules/partnerStore/application/partnerStoreProvisioningTransactionalService.js')
const readiness = read('src/modules/partnerStore/application/partnerStoreDocumentPurposeReadiness.js')
const bootstrapRepository = read('src/modules/document-purpose/bootstrap/systemDocumentPurposeBootstrapRepository.js')
const recovery = read('scripts/apply-document-purpose-system-bootstrap-current.js')

assert.match(runtime, /ensurePartnerStoreDocumentPurposeReadiness/)
assert.match(runtime, /await ensurePartnerStoreDocumentPurposeReadiness\(\{\s*tx,\s*branchId: branch\.id,/s)
assert.match(runtime, /const branch = await tx\.branch\.findUnique\([\s\S]*?await ensurePartnerStoreDocumentPurposeReadiness\([\s\S]*?const needsProvisioningReconciliation/s)
assert.match(runtime, /tx\.partnerStoreCapability\.create[\s\S]*?ensurePartnerStoreDocumentPurposeReadiness[\s\S]*?provisioningStatus: 'PROVISIONED'/)
assert.doesNotMatch(runtime, /ResolvePrintDocumentPurposeService/)

assert.match(readiness, /new SystemDocumentPurposeBootstrapRepository\(tx\)/)
assert.match(readiness, /new SystemDocumentPurposeBootstrapService\(repository\)/)
assert.match(readiness, /service\.execute\(\{ branchId, actorEmployeeId \}\)/)

assert.match(bootstrapRepository, /typeof this\.prisma\.\$transaction !== 'function'/)
assert.match(bootstrapRepository, /return work\(this\)/)
assert.match(bootstrapRepository, /this\.prisma\.\$transaction\(\(tx\) => work\(new SystemDocumentPurposeBootstrapRepository\(tx\)\)\)/)

assert.match(recovery, /At least one explicit --branch target is required/)
assert.match(recovery, /WRITE_SYSTEM_DOCUMENT_PURPOSES/)
assert.match(recovery, /SystemDocumentPurposeTargetApplyService/)
assert.match(recovery, /CURRENT_DATABASE_EXPLICIT_TARGETS/)
assert.doesNotMatch(recovery, /createDefinition\(/)
assert.doesNotMatch(recovery, /documentPurposeDefinition\.create\(/)

const {
  SystemDocumentPurposeBootstrapRepository,
} = require(path.join(root, 'src/modules/document-purpose/bootstrap/systemDocumentPurposeBootstrapRepository.js'))

let nestedTransactionCalled = false
const txClient = {
  branch: {},
  documentPurposeDefinition: {},
  documentPurposeVersion: {},
  documentPurposeEvent: {},
}
const repository = new SystemDocumentPurposeBootstrapRepository(txClient)
const returned = repository.transaction(async (sameRepository) => {
  assert.strictEqual(sameRepository, repository)
  nestedTransactionCalled = true
  return 'same-transaction'
})

Promise.resolve(returned).then((value) => {
  assert.strictEqual(value, 'same-transaction')
  assert.strictEqual(nestedTransactionCalled, true)
  console.log('Partner store document purpose readiness contract: PASS')
}).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
