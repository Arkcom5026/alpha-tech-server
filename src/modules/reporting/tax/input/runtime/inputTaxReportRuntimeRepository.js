const { prisma } = require('../../../../../../lib/prisma');

const findInputVatRecords = ({ branchId, startDate, endDate, take }) =>
  prisma.inputVatRecord.findMany({
    where: {
      branchId,
      documentDate: { gte: startDate, lte: endDate },
      ledgerType: { in: ['INPUT_VAT', 'INPUT_VAT_ADJUSTMENT'] },
    },
    include: {
      branch: { select: { id: true, name: true } },
      taxDocument: { select: { id: true, status: true } },
    },
    orderBy: [{ documentDate: 'asc' }, { documentNumber: 'asc' }, { id: 'asc' }],
    take,
  });

// Compatibility only for historical rows that predate InputVatRecord.
// New approved documents are superseded by InputVatRecord in the service projection.
const findLegacyInputTaxReceipts = ({ branchId, startDate, endDate, take }) =>
  prisma.purchaseOrderReceipt.findMany({
    where: {
      branchId,
      supplierTaxInvoiceDate: { gte: startDate, lte: endDate },
      supplierTaxInvoiceNumber: { not: null },
      purchaseOrder: { supplier: { isSystem: false } },
    },
    include: {
      branch: { select: { id: true, name: true } },
      purchaseOrder: { include: { supplier: true } },
      items: { select: { quantity: true, costPrice: true } },
    },
    orderBy: [
      { supplierTaxInvoiceDate: 'asc' },
      { supplierTaxInvoiceNumber: 'asc' },
      { id: 'asc' },
    ],
    take,
  });

module.exports = { findInputVatRecords, findLegacyInputTaxReceipts };
