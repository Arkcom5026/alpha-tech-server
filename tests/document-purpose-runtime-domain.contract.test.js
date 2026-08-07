'use strict'

const assert = require('assert')

const domain = require('../src/modules/document-purpose/shared/documentPurposeDomain')

const baseDefinition = {
  code: 'FULL_TAX_INVOICE',
  normalizedCode: 'FULL_TAX_INVOICE',
  displayName: 'ใบกำกับภาษีเต็มรูป',
  description: null,
  categoryCode: 'TAX',
  isSystem: true,
  lifecycleState: 'ACTIVE',
  sortOrder: 10,
  metadata: { paper: { width: 210, unit: 'mm' }, channels: ['PRINT'] },
}

assert.equal(domain.normalizeDocumentPurposeCode(' full-tax invoice '), 'FULL_TAX_INVOICE')
assert.equal(domain.normalizeDocumentPurposeCode('FULL__TAX___INVOICE'), 'FULL_TAX_INVOICE')
assert.throws(
  () => domain.normalizeDocumentPurposeCode('ใบกำกับภาษี'),
  (error) => error.code === 'DOCUMENT_PURPOSE_CODE_INVALID',
)

const snapshotA = domain.buildDocumentPurposeSnapshot(baseDefinition)
const snapshotB = domain.buildDocumentPurposeSnapshot({
  ...baseDefinition,
  metadata: { channels: ['PRINT'], paper: { unit: 'mm', width: 210 } },
})

assert.deepEqual(Object.keys(snapshotA), domain.SNAPSHOT_FIELDS)
assert.equal(domain.hashDocumentPurposeSnapshot(snapshotA).length, 64)
assert.equal(domain.hashDocumentPurposeSnapshot(snapshotA), domain.hashDocumentPurposeSnapshot(snapshotB))
assert.notEqual(
  domain.hashDocumentPurposeSnapshot(snapshotA),
  domain.hashDocumentPurposeSnapshot({ ...snapshotA, displayName: 'ชื่อใหม่' }),
)

const eventA = {
  definitionId: 9,
  versionId: 2,
  eventType: 'UPDATED',
  previousState: 'ACTIVE',
  resultingState: 'ACTIVE',
  actorEmployeeId: 4,
  reasonCode: 'ADMIN_EDIT',
  note: null,
  metadata: { changedFields: ['displayName', 'metadata'], detail: { b: 2, a: 1 } },
  idempotencyKey: 'req-123',
}
const eventB = {
  ...eventA,
  metadata: { detail: { a: 1, b: 2 }, changedFields: ['displayName', 'metadata'] },
}

assert.equal(domain.hashDocumentPurposeEvent(eventA).length, 64)
assert.equal(domain.hashDocumentPurposeEvent(eventA), domain.hashDocumentPurposeEvent(eventB))
assert.notEqual(domain.hashDocumentPurposeEvent(eventA), domain.hashDocumentPurposeEvent({ ...eventA, eventType: 'ARCHIVED' }))

assert.deepEqual(domain.assertLifecycleTransition('ACTIVE', 'INACTIVE'), {
  from: 'ACTIVE',
  to: 'INACTIVE',
  changed: true,
})
assert.deepEqual(domain.assertLifecycleTransition('INACTIVE', 'ACTIVE'), {
  from: 'INACTIVE',
  to: 'ACTIVE',
  changed: true,
})
assert.deepEqual(domain.assertLifecycleTransition('ACTIVE', 'ARCHIVED'), {
  from: 'ACTIVE',
  to: 'ARCHIVED',
  changed: true,
})
assert.deepEqual(domain.assertLifecycleTransition('ARCHIVED', 'ARCHIVED'), {
  from: 'ARCHIVED',
  to: 'ARCHIVED',
  changed: false,
})
assert.throws(
  () => domain.assertLifecycleTransition('ARCHIVED', 'ACTIVE'),
  (error) =>
    error.code === 'DOCUMENT_PURPOSE_LIFECYCLE_TRANSITION_INVALID' &&
    error.detail?.from === 'ARCHIVED' &&
    error.detail?.to === 'ACTIVE',
)

assert.deepEqual(
  domain.pickMutableDocumentPurposeFields({
    displayName: 'ใหม่',
    description: 'รายละเอียด',
    code: 'ILLEGAL_CODE_CHANGE',
    branchId: 99,
    metadata: { a: 1 },
  }),
  {
    displayName: 'ใหม่',
    description: 'รายละเอียด',
    metadata: { a: 1 },
  },
)

console.log('document-purpose-runtime-domain.contract.test.js: PASS')
