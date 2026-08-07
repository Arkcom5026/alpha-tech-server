'use strict'

const assert = require('assert')
const {
  SYSTEM_DOCUMENT_PURPOSES,
} = require('../src/modules/document-purpose/bootstrap/systemDocumentPurposeCatalog')
const {
  BOOTSTRAP_EVENT_TYPE,
  BOOTSTRAP_REASON_CODE,
  SystemDocumentPurposeBootstrapService,
} = require('../src/modules/document-purpose/bootstrap/systemDocumentPurposeBootstrapService')

const createRepository = ({ existing = [], branchExists = true } = {}) => {
  let nextDefinitionId = 100
  let nextVersionId = 500
  let nextEventId = 900
  const definitions = []
  const versions = []
  const events = []

  const repository = {
    definitions,
    versions,
    events,
    async branchExists() {
      return branchExists ? { id: 1 } : null
    },
    async findByNormalizedCodes() {
      return existing
    },
    async transaction(work) {
      return work(repository)
    },
    async createDefinition(data) {
      const row = { id: nextDefinitionId++, ...data }
      definitions.push(row)
      return row
    },
    async createVersion(data) {
      const row = { id: nextVersionId++, ...data }
      versions.push(row)
      return row
    },
    async createEvent(data) {
      const row = { id: nextEventId++, ...data }
      events.push(row)
      return row
    },
  }

  return repository
}

const expectedExisting = (purpose, id) => ({
  id,
  branchId: 1,
  code: purpose.code,
  normalizedCode: purpose.code,
  displayName: purpose.displayName,
  description: purpose.description,
  categoryCode: purpose.categoryCode,
  isSystem: true,
  lifecycleState: 'ACTIVE',
  sortOrder: purpose.sortOrder,
  metadata: purpose.metadata,
  currentVersion: 1,
})

;(async () => {
  const repository = createRepository()
  const service = new SystemDocumentPurposeBootstrapService(repository)
  const result = await service.execute({ branchId: 1 })

  assert.equal(result.changed, true)
  assert.equal(result.created.length, SYSTEM_DOCUMENT_PURPOSES.length)
  assert.equal(repository.definitions.length, SYSTEM_DOCUMENT_PURPOSES.length)
  assert.equal(repository.versions.length, SYSTEM_DOCUMENT_PURPOSES.length)
  assert.equal(repository.events.length, SYSTEM_DOCUMENT_PURPOSES.length)

  for (let index = 0; index < SYSTEM_DOCUMENT_PURPOSES.length; index += 1) {
    const catalog = SYSTEM_DOCUMENT_PURPOSES[index]
    const definition = repository.definitions[index]
    const version = repository.versions[index]
    const event = repository.events[index]

    assert.equal(definition.branchId, 1)
    assert.equal(definition.code, catalog.code)
    assert.equal(definition.normalizedCode, catalog.code)
    assert.equal(definition.isSystem, true)
    assert.equal(definition.lifecycleState, 'ACTIVE')
    assert.equal(definition.currentVersion, 1)
    assert.equal(definition.createdByEmployeeId, null)
    assert.equal(definition.updatedByEmployeeId, null)

    assert.equal(version.definitionId, definition.id)
    assert.equal(version.version, 1)
    assert.equal(version.isSystem, true)
    assert.match(version.snapshotHash, /^[a-f0-9]{64}$/)

    assert.equal(event.definitionId, definition.id)
    assert.equal(event.versionId, version.id)
    assert.equal(event.eventType, BOOTSTRAP_EVENT_TYPE)
    assert.equal(event.reasonCode, BOOTSTRAP_REASON_CODE)
    assert.equal(event.idempotencyKey, `system-catalog-v1:${catalog.code}`)
    assert.match(event.eventHash, /^[a-f0-9]{64}$/)
  }

  const allExisting = SYSTEM_DOCUMENT_PURPOSES.map((purpose, index) =>
    expectedExisting(purpose, index + 1),
  )
  const replayRepository = createRepository({ existing: allExisting })
  const replay = await new SystemDocumentPurposeBootstrapService(replayRepository)
    .execute({ branchId: 1, actorEmployeeId: 9 })

  assert.equal(replay.changed, false)
  assert.equal(replay.created.length, 0)
  assert.equal(replayRepository.definitions.length, 0)
  assert.equal(replayRepository.versions.length, 0)
  assert.equal(replayRepository.events.length, 0)

  const reorderedMetadataExisting = SYSTEM_DOCUMENT_PURPOSES.map((purpose, index) => {
    const row = expectedExisting(purpose, index + 20)
    const metadata = purpose.metadata ?? {}
    row.metadata = {
      systemCatalogVersion: metadata.systemCatalogVersion,
      printEligible: metadata.printEligible,
      purposeFamily: metadata.purposeFamily,
    }
    return row
  })
  const reorderedRepository = createRepository({ existing: reorderedMetadataExisting })
  const reorderedReplay = await new SystemDocumentPurposeBootstrapService(reorderedRepository)
    .execute({ branchId: 1 })

  assert.equal(reorderedReplay.changed, false)
  assert.equal(reorderedReplay.created.length, 0)
  assert.equal(reorderedRepository.definitions.length, 0)
  assert.equal(reorderedRepository.versions.length, 0)
  assert.equal(reorderedRepository.events.length, 0)

  const customConflict = expectedExisting(SYSTEM_DOCUMENT_PURPOSES[0], 7)
  customConflict.isSystem = false
  await assert.rejects(
    () => new SystemDocumentPurposeBootstrapService(
      createRepository({ existing: [customConflict] }),
    ).execute({ branchId: 1 }),
    (error) => error.code === 'DOCUMENT_PURPOSE_SYSTEM_CODE_CONFLICT' && error.statusCode === 409,
  )

  const drift = expectedExisting(SYSTEM_DOCUMENT_PURPOSES[0], 8)
  drift.displayName = 'Drifted label'
  await assert.rejects(
    () => new SystemDocumentPurposeBootstrapService(
      createRepository({ existing: [drift] }),
    ).execute({ branchId: 1 }),
    (error) => error.code === 'DOCUMENT_PURPOSE_SYSTEM_DRIFT' && error.statusCode === 409,
  )

  await assert.rejects(
    () => new SystemDocumentPurposeBootstrapService(
      createRepository({ branchExists: false }),
    ).execute({ branchId: 999 }),
    (error) => error.code === 'DOCUMENT_PURPOSE_BRANCH_NOT_FOUND' && error.statusCode === 404,
  )

  await assert.rejects(
    () => service.execute({ branchId: 0 }),
    (error) => error.code === 'DOCUMENT_PURPOSE_CONTEXT_INVALID',
  )

  console.log('document-purpose-system-bootstrap-runtime.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
