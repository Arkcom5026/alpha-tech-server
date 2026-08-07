'use strict'

const assert = require('assert')
const Module = require('module')

const servicePath = require.resolve('../src/modules/document-purpose/create/documentPurposeCreateService')
const repositoryPath = require.resolve('../src/modules/document-purpose/create/documentPurposeCreateRepository')

class StubRepositoryClass {}
const repositoryModuleStub = {
  DocumentPurposeCreateRepository: StubRepositoryClass,
  isKnownRequestError: () => false,
}

const originalLoad = Module._load
Module._load = function patchedLoad(request, parent, isMain) {
  if (parent?.filename === servicePath && request === './documentPurposeCreateRepository') {
    return repositoryModuleStub
  }
  return originalLoad.call(this, request, parent, isMain)
}

delete require.cache[servicePath]
delete require.cache[repositoryPath]
const { DocumentPurposeCreateService, buildCreateState } = require(servicePath)
Module._load = originalLoad

const actor = { branchId: 2, employeeId: 35 }

const createRepository = ({ duplicate = null } = {}) => {
  const calls = []
  let nextId = 100

  const tx = {
    createDefinition: async (data) => {
      calls.push({ type: 'definition', data })
      return { id: nextId++, ...data }
    },
    createVersion: async (data) => {
      calls.push({ type: 'version', data })
      return { id: nextId++, createdAt: new Date('2026-08-07T00:00:00.000Z'), ...data }
    },
    createEvent: async (data) => {
      calls.push({ type: 'event', data })
      return { id: nextId++, occurredAt: new Date('2026-08-07T00:00:00.000Z'), ...data }
    },
  }

  return {
    calls,
    findByNormalizedCode: async (branchId, normalizedCode) => {
      calls.push({ type: 'lookup', branchId, normalizedCode })
      return duplicate
    },
    transaction: async (work) => {
      calls.push({ type: 'transaction:start' })
      const result = await work(tx)
      calls.push({ type: 'transaction:commit' })
      return result
    },
  }
}

;(async () => {
  const state = buildCreateState({
    actor,
    input: {
      branchId: 999,
      code: ' full-tax invoice ',
      displayName: 'ใบกำกับภาษีเต็มรูป',
      categoryCode: 'TAX',
      metadata: { paper: 'A4', nested: { b: 2, a: 1 } },
    },
  })
  assert.equal(state.branchId, 2)
  assert.equal(state.definition.branchId, 2)
  assert.equal(state.definition.normalizedCode, 'FULL_TAX_INVOICE')
  assert.equal(state.definition.isSystem, false)
  assert.equal(state.definition.currentVersion, 1)
  assert.equal(state.definition.createdByEmployeeId, 35)
  assert.equal(state.definition.updatedByEmployeeId, 35)

  const repository = createRepository()
  const service = new DocumentPurposeCreateService(repository)
  const created = await service.execute({
    actor,
    input: {
      code: 'full-tax invoice',
      displayName: 'ใบกำกับภาษีเต็มรูป',
      description: 'Full tax invoice output',
      categoryCode: 'TAX',
      sortOrder: 20,
      metadata: { paper: 'A4' },
      changeReason: 'Initial registration',
      reasonCode: 'USER_CREATE',
      idempotencyKey: 'create-full-tax-invoice-1',
    },
  })

  assert.equal(repository.calls[0].type, 'lookup')
  assert.equal(repository.calls[0].branchId, 2)
  assert.equal(repository.calls[0].normalizedCode, 'FULL_TAX_INVOICE')
  assert.deepEqual(
    repository.calls.filter((call) => ['definition', 'version', 'event'].includes(call.type)).map((call) => call.type),
    ['definition', 'version', 'event'],
  )
  assert.equal(repository.calls.at(-1).type, 'transaction:commit')

  assert.equal(created.definition.lifecycleState, 'ACTIVE')
  assert.equal(created.version.definitionId, created.definition.id)
  assert.equal(created.version.version, 1)
  assert.match(created.version.snapshotHash, /^[a-f0-9]{64}$/)
  assert.equal(created.event.definitionId, created.definition.id)
  assert.equal(created.event.versionId, created.version.id)
  assert.equal(created.event.eventType, 'CREATED')
  assert.equal(created.event.previousState, null)
  assert.equal(created.event.resultingState, 'ACTIVE')
  assert.equal(created.event.actorEmployeeId, 35)
  assert.match(created.event.eventHash, /^[a-f0-9]{64}$/)

  const duplicateRepository = createRepository({
    duplicate: { id: 77, branchId: 2, code: 'FULL_TAX_INVOICE', normalizedCode: 'FULL_TAX_INVOICE' },
  })
  const duplicateService = new DocumentPurposeCreateService(duplicateRepository)
  await assert.rejects(
    () => duplicateService.execute({
      actor,
      input: { code: ' FULL-TAX   INVOICE ', displayName: 'Duplicate' },
    }),
    (error) => error.code === 'DOCUMENT_PURPOSE_DUPLICATE_CODE' && error.statusCode === 409,
  )
  assert.equal(duplicateRepository.calls.some((call) => call.type === 'transaction:start'), false)

  await assert.rejects(
    () => service.execute({
      actor: { branchId: 2 },
      input: { code: 'RECEIPT', displayName: 'Receipt' },
    }),
    (error) => error.code === 'DOCUMENT_PURPOSE_CONTEXT_INVALID',
  )

  console.log('document-purpose-create-runtime.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
