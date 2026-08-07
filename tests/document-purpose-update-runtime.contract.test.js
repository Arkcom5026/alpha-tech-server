'use strict'

const assert = require('assert')
const { DocumentPurposeUpdateService } = require('../src/modules/document-purpose/update/documentPurposeUpdateService')

const calls = []
const current = {
  id: 10,
  branchId: 2,
  code: 'FULL_TAX_INVOICE',
  normalizedCode: 'FULL_TAX_INVOICE',
  displayName: 'ใบกำกับภาษีเต็มรูป',
  description: null,
  categoryCode: 'TAX',
  isSystem: false,
  lifecycleState: 'ACTIVE',
  sortOrder: 10,
  metadata: { paper: 'A4' },
  currentVersion: 1,
  updatedByEmployeeId: 4,
}

let stored = { ...current }
let versionId = 100
let eventId = 200
let forceConcurrentConflict = false
let replayEvent = null

const repository = {
  findEventByIdempotencyKey: async (input) => {
    calls.push({ type: 'findIdempotency', input })
    return replayEvent
  },
  findCurrent: async (input) => {
    calls.push({ type: 'findCurrent', input })
    return input.branchId === 2 && input.definitionId === 10 ? { ...stored } : null
  },
  transaction: async (work) => {
    calls.push({ type: 'transaction' })
    const before = { ...stored }
    try {
      return await work(repository)
    } catch (error) {
      stored = before
      throw error
    }
  },
  updateDefinitionIfVersion: async ({ branchId, definitionId, expectedVersion, data }) => {
    calls.push({ type: 'updateDefinitionIfVersion', branchId, definitionId, expectedVersion, data })
    if (forceConcurrentConflict || stored.currentVersion !== expectedVersion) return { count: 0 }
    stored = { ...stored, ...data }
    return { count: 1 }
  },
  createVersion: async (data) => {
    calls.push({ type: 'createVersion', data })
    return { id: ++versionId, ...data }
  },
  createEvent: async (data) => {
    calls.push({ type: 'createEvent', data })
    return { id: ++eventId, ...data }
  },
  findById: async () => ({ ...stored }),
}

const service = new DocumentPurposeUpdateService(repository)
const actor = { branchId: 2, employeeId: 4 }

;(async () => {
  calls.length = 0
  stored = { ...current }
  const result = await service.execute({
    actor,
    definitionId: 10,
    input: {
      displayName: 'ใบกำกับภาษีเต็มรูปแบบ',
      description: 'เอกสารภาษีเต็มรูป',
      metadata: { paper: 'A4', copies: 2 },
      idempotencyKey: 'update-1',
    },
  })

  assert.equal(result.changed, true)
  assert.equal(result.definition.currentVersion, 2)
  assert.equal(result.version.version, 2)
  assert.equal(result.version.displayName, 'ใบกำกับภาษีเต็มรูปแบบ')
  assert.equal(result.version.snapshotHash.length, 64)
  assert.equal(result.event.eventType, 'UPDATED')
  assert.equal(result.event.previousState, 'ACTIVE')
  assert.equal(result.event.resultingState, 'ACTIVE')
  assert.equal(result.event.eventHash.length, 64)
  assert.equal(result.event.idempotencyKey, 'update-1')
  assert.equal(calls.filter((call) => call.type === 'transaction').length, 1)
  assert.equal(calls.filter((call) => call.type === 'createVersion').length, 1)
  assert.equal(calls.filter((call) => call.type === 'createEvent').length, 1)

  calls.length = 0
  stored = { ...current }
  const noOp = await service.execute({
    actor,
    definitionId: 10,
    input: { displayName: current.displayName, metadata: { paper: 'A4' } },
  })
  assert.equal(noOp.changed, false)
  assert.equal(noOp.version, null)
  assert.equal(noOp.event, null)
  assert.equal(calls.some((call) => call.type === 'transaction'), false)

  await assert.rejects(
    () => service.execute({ actor, definitionId: 10, input: { code: 'RECEIPT' } }),
    (error) => error.code === 'DOCUMENT_PURPOSE_IMMUTABLE_FIELD' && error.detail.fields.includes('code'),
  )

  await assert.rejects(
    () => service.execute({ actor, definitionId: 10, input: { normalizedCode: 'RECEIPT' } }),
    (error) => error.code === 'DOCUMENT_PURPOSE_IMMUTABLE_FIELD',
  )

  await assert.rejects(
    () => service.execute({ actor: { branchId: 3, employeeId: 4 }, definitionId: 10, input: { displayName: 'x' } }),
    (error) => error.code === 'DOCUMENT_PURPOSE_NOT_FOUND' && error.statusCode === 404,
  )

  calls.length = 0
  stored = { ...current }
  forceConcurrentConflict = true
  await assert.rejects(
    () => service.execute({ actor, definitionId: 10, input: { displayName: 'concurrent' } }),
    (error) => error.code === 'DOCUMENT_PURPOSE_CONCURRENT_UPDATE' && error.statusCode === 409,
  )
  forceConcurrentConflict = false
  assert.equal(stored.currentVersion, 1)

  replayEvent = {
    id: 999,
    eventType: 'UPDATED',
    definition: { ...current, displayName: 'replayed', currentVersion: 2 },
    version: { id: 998, definitionId: 10, version: 2 },
  }
  calls.length = 0
  const replay = await service.execute({
    actor,
    definitionId: 10,
    input: { displayName: 'ignored retry body', idempotencyKey: 'update-replay' },
  })
  assert.equal(replay.replayed, true)
  assert.equal(replay.definition.displayName, 'replayed')
  assert.deepEqual(calls.map((call) => call.type), ['findIdempotency'])

  replayEvent = { id: 997, eventType: 'ARCHIVED', definition: current, version: null }
  await assert.rejects(
    () => service.execute({ actor, definitionId: 10, input: { displayName: 'x', idempotencyKey: 'wrong-use' } }),
    (error) => error.code === 'DOCUMENT_PURPOSE_IDEMPOTENCY_CONFLICT' && error.statusCode === 409,
  )
  replayEvent = null

  console.log('document-purpose-update-runtime.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
