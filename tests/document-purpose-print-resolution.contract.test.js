'use strict'

const assert = require('assert')
const {
  ResolvePrintDocumentPurposeService,
} = require('../src/modules/document-purpose/resolve/resolvePrintDocumentPurposeService')

const activePurpose = Object.freeze({
  id: 22,
  branchId: 2,
  code: 'DELIVERY_NOTE',
  normalizedCode: 'DELIVERY_NOTE',
  displayName: 'ใบส่งสินค้า',
  description: 'เอกสารประกอบการส่งมอบสินค้าจากการขาย',
  categoryCode: 'SALES',
  isSystem: true,
  lifecycleState: 'ACTIVE',
  sortOrder: 200,
  metadata: {
    purposeFamily: 'SALE',
    printEligible: true,
    systemCatalogVersion: 1,
  },
  currentVersion: 1,
})

const repositoryWith = (row) => ({
  calls: [],
  async findByCode(input) {
    this.calls.push(input)
    return row
  },
})

;(async () => {
  const repository = repositoryWith(activePurpose)
  const result = await new ResolvePrintDocumentPurposeService(repository).execute({
    branchId: '2',
    code: ' delivery-note ',
  })

  assert.deepEqual(repository.calls, [
    { branchId: 2, normalizedCode: 'DELIVERY_NOTE' },
  ])
  assert.equal(result.id, activePurpose.id)
  assert.equal(result.code, 'DELIVERY_NOTE')
  assert.equal(result.displayName, 'ใบส่งสินค้า')
  assert.equal(result.currentVersion, 1)
  assert.equal(result.metadata.printEligible, true)

  await assert.rejects(
    () => new ResolvePrintDocumentPurposeService(repositoryWith(null)).execute({
      branchId: 2,
      code: 'DELIVERY_NOTE',
    }),
    (error) => error.code === 'DOCUMENT_PURPOSE_NOT_FOUND' && error.statusCode === 404,
  )

  await assert.rejects(
    () => new ResolvePrintDocumentPurposeService(repositoryWith({
      ...activePurpose,
      isSystem: false,
    })).execute({ branchId: 2, code: 'DELIVERY_NOTE' }),
    (error) => error.code === 'DOCUMENT_PURPOSE_SYSTEM_REQUIRED' && error.statusCode === 409,
  )

  await assert.rejects(
    () => new ResolvePrintDocumentPurposeService(repositoryWith({
      ...activePurpose,
      lifecycleState: 'INACTIVE',
    })).execute({ branchId: 2, code: 'DELIVERY_NOTE' }),
    (error) => error.code === 'DOCUMENT_PURPOSE_INACTIVE' && error.statusCode === 409,
  )

  await assert.rejects(
    () => new ResolvePrintDocumentPurposeService(repositoryWith({
      ...activePurpose,
      metadata: { ...activePurpose.metadata, printEligible: false },
    })).execute({ branchId: 2, code: 'DELIVERY_NOTE' }),
    (error) => error.code === 'DOCUMENT_PURPOSE_PRINT_NOT_ELIGIBLE' && error.statusCode === 409,
  )

  await assert.rejects(
    () => new ResolvePrintDocumentPurposeService(repository).execute({
      branchId: 0,
      code: 'DELIVERY_NOTE',
    }),
    (error) => error.code === 'DOCUMENT_PURPOSE_CONTEXT_INVALID' && error.statusCode === 400,
  )

  console.log('document-purpose-print-resolution.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
