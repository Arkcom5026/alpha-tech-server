'use strict'

const assert = require('assert')
const { DocumentPurposeLifecycleService } = require('../src/modules/document-purpose/lifecycle/documentPurposeLifecycleService')

const base = {
  id: 10,
  branchId: 2,
  code: 'RECEIPT',
  normalizedCode: 'RECEIPT',
  displayName: 'Receipt',
  description: null,
  categoryCode: null,
  isSystem: false,
  lifecycleState: 'ACTIVE',
  sortOrder: 0,
  metadata: null,
  currentVersion: 1,
  archivedAt: null,
}

const calls = []
let current = { ...base }
let replay = null
const repository = {
  findEventByIdempotencyKey: async () => replay,
  findCurrent: async ({ branchId, definitionId }) =>
    branchId === 2 && definitionId === 10 ? { ...current } : null,
  transaction: async (work) => work(repository),
  updateDefinitionIfVersion: async ({ expectedVersion, data }) => {
    calls.push({ type: 'update', expectedVersion, data })
    if (current.currentVersion !== expectedVersion) return { count: 0 }
    current = { ...current, ...data }
    return { count: 1 }
  },
  createVersion: async (data) => {
    calls.push({ type: 'version', data })
    return { id: 100 + data.version, ...data }
  },
  createEvent: async (data) => {
    calls.push({ type: 'event', data })
    return { id: 200 + data.versionId, ...data }
  },
  findById: async () => ({ ...current }),
}

const service = new DocumentPurposeLifecycleService(repository)

;(async () => {
  calls.length = 0
  current = { ...base }
  const inactive = await service.execute({
    actor: { branchId: 2, employeeId: 7 },
    definitionId: 10,
    input: { targetState: 'inactive', idempotencyKey: 'life-1' },
  })
  assert.equal(inactive.changed, true)
  assert.equal(inactive.definition.lifecycleState, 'INACTIVE')
  assert.equal(inactive.definition.currentVersion, 2)
  assert.equal(calls[1].data.lifecycleState, 'INACTIVE')
  assert.equal(calls[2].data.eventType, 'DEACTIVATED')
  assert.equal(calls[2].data.previousState, 'ACTIVE')
  assert.equal(calls[2].data.resultingState, 'INACTIVE')

  calls.length = 0
  const active = await service.execute({
    actor: { branchId: 2, employeeId: 7 },
    definitionId: 10,
    input: { targetState: 'ACTIVE' },
  })
  assert.equal(active.definition.lifecycleState, 'ACTIVE')
  assert.equal(active.definition.currentVersion, 3)
  assert.equal(calls[2].data.eventType, 'ACTIVATED')

  calls.length = 0
  const archived = await service.execute({
    actor: { branchId: 2, employeeId: 7 },
    definitionId: 10,
    input: { targetState: 'ARCHIVED' },
  })
  assert.equal(archived.definition.lifecycleState, 'ARCHIVED')
  assert.ok(archived.definition.archivedAt instanceof Date)
  assert.equal(calls[2].data.eventType, 'ARCHIVED')

  await assert.rejects(
    () => service.execute({ actor: { branchId: 2, employeeId: 7 }, definitionId: 10, input: { targetState: 'ACTIVE' } }),
    (error) => error.code === 'DOCUMENT_PURPOSE_LIFECYCLE_TRANSITION_INVALID',
  )

  current = { ...base, isSystem: true }
  await assert.rejects(
    () => service.execute({ actor: { branchId: 2, employeeId: 7 }, definitionId: 10, input: { targetState: 'ARCHIVED' } }),
    (error) => error.code === 'DOCUMENT_PURPOSE_SYSTEM_POLICY_FORBIDDEN' && error.statusCode === 403,
  )

  current = { ...base }
  const noop = await service.execute({
    actor: { branchId: 2, employeeId: 7 },
    definitionId: 10,
    input: { targetState: 'ACTIVE' },
  })
  assert.equal(noop.changed, false)
  assert.equal(noop.version, null)
  assert.equal(noop.event, null)

  replay = {
    id: 300,
    eventType: 'DEACTIVATED',
    definition: { ...base, lifecycleState: 'INACTIVE', currentVersion: 2 },
    version: { id: 102, definitionId: 10, version: 2 },
  }
  const replayed = await service.execute({
    actor: { branchId: 2, employeeId: 7 },
    definitionId: 10,
    input: { targetState: 'INACTIVE', idempotencyKey: 'life-retry' },
  })
  assert.equal(replayed.replayed, true)

  await assert.rejects(
    () => service.execute({
      actor: { branchId: 2, employeeId: 7 },
      definitionId: 10,
      input: { targetState: 'ARCHIVED', idempotencyKey: 'life-retry' },
    }),
    (error) => error.code === 'DOCUMENT_PURPOSE_IDEMPOTENCY_CONFLICT',
  )

  replay = null
  current = { ...base }
  const concurrentRepository = {
    ...repository,
    updateDefinitionIfVersion: async () => ({ count: 0 }),
  }
  concurrentRepository.transaction = async (work) => work(concurrentRepository)
  const concurrentService = new DocumentPurposeLifecycleService(concurrentRepository)
  await assert.rejects(
    () => concurrentService.execute({
      actor: { branchId: 2, employeeId: 7 },
      definitionId: 10,
      input: { targetState: 'INACTIVE' },
    }),
    (error) => error.code === 'DOCUMENT_PURPOSE_CONCURRENT_UPDATE' && error.statusCode === 409,
  )

  await assert.rejects(
    () => service.execute({ actor: { branchId: 3, employeeId: 7 }, definitionId: 10, input: { targetState: 'INACTIVE' } }),
    (error) => error.code === 'DOCUMENT_PURPOSE_NOT_FOUND',
  )

  console.log('document-purpose-lifecycle-runtime.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
