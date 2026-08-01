const { prisma } = require('../../../../../../lib/prisma');

const findInputTaxReceipts = ({ branchId, startDate, endDate }) =>
  prisma.purchaseOrderReceipt.findMany({
    where: {
      branchId,
      supplierTaxInvoiceDate: { gte: startDate, lte: endDate },
      supplierTaxInvoiceNumber: { not: null },
      purchaseOrder: { supplier: { isSystem: false } },
    },
    include: {
      branch: true,
      purchaseOrder: { include: { supplier: true } },
      items: { select: { quantity: true, costPrice: true } },
    },
    orderBy: { supplierTaxInvoiceDate: 'asc' },
  });

module.exports = { findInputTaxReceipts };
