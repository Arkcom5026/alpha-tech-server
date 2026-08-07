'use strict'

const assert = require('assert')
const { DocumentPurposeReadService } = require('../src/modules/document-purpose/read/documentPurposeReadService')

const calls = []
const repository = {
  list: async (input) => {
    calls.push({ type: 'list', input })
    return [{ id: 1, branchId: input.branchId, code: 'RECEIPT' }]
  },
  findById: async (input) => {
    calls.push({ type: 'findById', input })
    if (input.branchId === 2 && input.definitionId === 10) {
      return { id: 10, branchId: 2, code: 'FULL_TAX_INVOICE' }
    }
    return null
  },
  findByCode: async (input) => {
    calls.push({ type: 'findByCode', input })
    if (input.branchId === 2 && input.normalizedCode === 'FULL_TAX_INVOICE') {
      return { id: 10, branchId: 2, code: 'FULL_TAX_INVOICE' }
    }
    return null
  },
  listVersions: async (input) => {
    calls.push({ type: 'versions', input })
    return [
      { id: 100, definitionId: 10, version: 1 },
      { id: 101, definitionId: 10, version: 2 },
    ]
  },
  listEvents: async (input) => {
    calls.push({ type: 'events', input })
    return [
      { id: 200, definitionId: 10, eventType: 'CREATED' },
      { id: 201, definitionId: 10, eventType: 'UPDATED' },
    ]
  },
}

const service = new DocumentPurposeReadService(repository)

;(async () => {
  calls.length = 0
  const list = await service.list({ branchId: 2, query: {} })
  assert.equal(list.length, 1)
  assert.deepEqual(calls[0], {
    type: 'list',
    input: {
      branchId: 2,
      lifecycleState: null,
      categoryCode: null,
      includeArchived: false,
    },
  })

  calls.length = 0
  await service.list({
    branchId: 2,
    query: { lifecycleState: 'inactive', categoryCode: ' TAX ', includeArchived: 'true' },
  })
  assert.deepEqual(calls[0].input, {
    branchId: 2,
    lifecycleState: 'INACTIVE',
    categoryCode: 'TAX',
    includeArchived: true,
  })

  calls.length = 0
  const byId = await service.getById({ branchId: 2, definitionId: 10 })
  assert.equal(byId.id, 10)
  assert.deepEqual(calls[0].input, { branchId: 2, definitionId: 10 })

  await assert.rejects(
    () => service.getById({ branchId: 3, definitionId: 10 }),
    (error) => error.code === 'DOCUMENT_PURPOSE_NOT_FOUND' && error.statusCode === 404,
  )

  calls.length = 0
  const byCode = await service.getByCode({ branchId: 2, code: ' full-tax invoice ' })
  assert.equal(byCode.id, 10)
  assert.deepEqual(calls[0].input, {
    branchId: 2,
    normalizedCode: 'FULL_TAX_INVOICE',
  })

  calls.length = 0
  const versions = await service.listVersions({ branchId: 2, definitionId: 10 })
  assert.equal(versions.length, 2)
  assert.deepEqual(calls.map((call) => call.type), ['findById', 'versions'])
  assert.deepEqual(calls[1].input, { branchId: 2, definitionId: 10 })

  calls.length = 0
  const events = await service.listEvents({ branchId: 2, definitionId: 10 })
  assert.equal(events.length, 2)
  assert.deepEqual(calls.map((call) => call.type), ['findById', 'events'])
  assert.deepEqual(calls[1].input, { branchId: 2, definitionId: 10 })

  calls.length = 0
  await assert.rejects(
    () => service.listVersions({ branchId: 3, definitionId: 10 }),
    (error) => error.code === 'DOCUMENT_PURPOSE_NOT_FOUND',
  )
  assert.deepEqual(calls.map((call) => call.type), ['findById'])

  await assert.rejects(
    () => service.list({ branchId: 2, query: { lifecycleState: 'DELETED' } }),
    (error) => error.code === 'DOCUMENT_PURPOSE_LIFECYCLE_INVALID',
  )

  console.log('document-purpose-read-runtime.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
