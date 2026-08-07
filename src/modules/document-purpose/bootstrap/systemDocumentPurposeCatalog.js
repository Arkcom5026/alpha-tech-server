'use strict'

const SYSTEM_DOCUMENT_PURPOSES = Object.freeze([
  Object.freeze({
    code: 'SALE_RECEIPT',
    displayName: 'ใบเสร็จรับเงิน',
    description: 'เอกสารรับรองการรับชำระเงินจากการขาย',
    categoryCode: 'SALES',
    sortOrder: 100,
    metadata: Object.freeze({
      purposeFamily: 'SALE',
      printEligible: true,
      systemCatalogVersion: 1,
    }),
  }),
  Object.freeze({
    code: 'DELIVERY_NOTE',
    displayName: 'ใบส่งสินค้า',
    description: 'เอกสารประกอบการส่งมอบสินค้าจากการขาย',
    categoryCode: 'SALES',
    sortOrder: 200,
    metadata: Object.freeze({
      purposeFamily: 'SALE',
      printEligible: true,
      systemCatalogVersion: 1,
    }),
  }),
  Object.freeze({
    code: 'SHORT_TAX_INVOICE',
    displayName: 'ใบกำกับภาษีอย่างย่อ',
    description: 'เอกสารภาษีขายแบบอย่างย่อ',
    categoryCode: 'TAX',
    sortOrder: 300,
    metadata: Object.freeze({
      purposeFamily: 'OUTPUT_TAX',
      printEligible: true,
      systemCatalogVersion: 1,
    }),
  }),
  Object.freeze({
    code: 'FULL_TAX_INVOICE',
    displayName: 'ใบกำกับภาษีเต็มรูป',
    description: 'เอกสารภาษีขายแบบเต็มรูป',
    categoryCode: 'TAX',
    sortOrder: 400,
    metadata: Object.freeze({
      purposeFamily: 'OUTPUT_TAX',
      printEligible: true,
      systemCatalogVersion: 1,
    }),
  }),
])

const SYSTEM_DOCUMENT_PURPOSE_CODES = Object.freeze(
  SYSTEM_DOCUMENT_PURPOSES.map((purpose) => purpose.code),
)

module.exports = {
  SYSTEM_DOCUMENT_PURPOSES,
  SYSTEM_DOCUMENT_PURPOSE_CODES,
}
