'use strict'

const assert = require('assert')
const {
  SystemDocumentPurposeReadinessService,
} = require('../src/modules/document-purpose/bootstrap/systemDocumentPurposeReadinessService')

const branches = [
  { id: 1, name: 'Branch One' },
  { id: 2, name: 'Branch Two' },
  { id: 3, name: 'Branch Three Missing Only' },
]

const systemRow = (branchId, code, overrides = {}) => ({
  id: Number(`${branchId}${code.length}`),
  branchId,
  code,
  normalizedCode: code,
  displayName: {
    SALE_RECEIPT: 'ใบเสร็จรับเงิน',
    DELIVERY_NOTE: 'ใบส่งสินค้า',
    SHORT_TAX_INVOICE: 'ใบกำกับภาษีอย่างย่อ',
    FULL_TAX_INVOICE: 'ใบกำกับภาษีเต็มรูป',
  }[code],
  description: {
    SALE_RECEIPT: 'เอกสารรับรองการรับชำระเงินจากการขาย',
    DELIVERY_NOTE: 'เอกสารประกอบการส่งมอบสินค้าจากการขาย',
    SHORT_TAX_INVOICE: 'เอกสารภาษีขายแบบอย่างย่อ',
    FULL_TAX_INVOICE: 'เอกสารภาษีขายแบบเต็มรูป',
  }[code],
  categoryCode: code.includes('TAX') ? 'TAX' : 'SALES',
  isSystem: true,
  lifecycleState: 'ACTIVE',
  sortOrder: {
    SALE_RECEIPT: 100,
    DELIVERY_NOTE: 200,
    SHORT_TAX_INVOICE: 300,
    FULL_TAX_INVOICE: 400,
  }[code],
  metadata: {
    purposeFamily: code.includes('TAX') ? 'OUTPUT_TAX' : 'SALE',
    printEligible: true,
    systemCatalogVersion: 1,
  },
  currentVersion: 1,
  ...overrides,
})

const allCodes = [
  'SALE_RECEIPT',
  'DELIVERY_NOTE',
  'SHORT_TAX_INVOICE',
  'FULL_TAX_INVOICE',
]

;(async () => {
  const repository = {
    async listBranches() {
      return branches
    },
    async findByNormalizedCodes(branchId) {
      if (branchId === 1) return allCodes.map((code) => systemRow(branchId, code))
      if (branchId === 3) return []
      return [
        systemRow(branchId, 'SALE_RECEIPT', { isSystem: false }),
        systemRow(branchId, 'DELIVERY_NOTE', { displayName: 'DRIFT' }),
      ]
    },
  }

  const report = await new SystemDocumentPurposeReadinessService(repository).execute()

  assert.strictEqual(report.mode, 'READ_ONLY')
  assert.strictEqual(report.catalogSize, 4)
  assert.strictEqual(report.branchCount, 3)
  assert.strictEqual(report.ready, false)

  assert.deepStrictEqual(report.branches[0].existing, allCodes)
  assert.deepStrictEqual(report.branches[0].missing, [])
  assert.strictEqual(report.branches[0].ready, true)

  assert.deepStrictEqual(report.branches[1].missing, ['SHORT_TAX_INVOICE', 'FULL_TAX_INVOICE'])
  assert.strictEqual(report.branches[1].conflicts.length, 1)
  assert.strictEqual(report.branches[1].conflicts[0].reason, 'CUSTOM_OWNS_RESERVED_CODE')
  assert.strictEqual(report.branches[1].drift.length, 1)
  assert.strictEqual(report.branches[1].drift[0].reason, 'SYSTEM_DEFINITION_DRIFT')
  assert.strictEqual(report.branches[1].ready, false)

  assert.deepStrictEqual(report.branches[2].missing, allCodes)
  assert.deepStrictEqual(report.branches[2].conflicts, [])
  assert.deepStrictEqual(report.branches[2].drift, [])
  assert.strictEqual(report.branches[2].ready, false)

  assert.deepStrictEqual(report.totals, {
    missing: 6,
    existing: 4,
    conflicts: 1,
    drift: 1,
  })

  console.log('document-purpose-system-bootstrap-readiness.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
