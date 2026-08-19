'use strict';

const { prisma } = require('../../../../../lib/prisma');

const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const positiveInt = (value, code, field) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail(code, `${field} must be a positive integer`);
  return parsed;
};

const issueSaleDeliveryNote = async ({ branchId, saleId }) => {
  const normalizedBranchId = positiveInt(branchId, 'SALE_BRANCH_REQUIRED', 'branchId');
  const normalizedSaleId = positiveInt(saleId, 'SALE_ID_REQUIRED', 'saleId');

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: normalizedSaleId, branchId: normalizedBranchId },
      select: {
        id: true,
        code: true,
        status: true,
        officialDocumentNumber: true,
      },
    });

    if (!sale) fail('SALE_NOT_FOUND', 'Sale not found', 404);
    if (sale.status === 'CANCELLED') {
      fail('DELIVERY_NOTE_SALE_CANCELLED', 'A cancelled sale cannot be issued a delivery note', 409);
    }

    const consumed = await tx.consolidatedDeliveryLine.findFirst({
      where: {
        branchId: normalizedBranchId,
        sourceSaleId: normalizedSaleId,
        status: 'DOCUMENTED',
        combinedBilling: { is: { status: { not: 'CANCELLED' } } },
      },
      select: { combinedBillingId: true },
    });
    if (consumed) {
      fail(
        'DELIVERY_NOTE_ALREADY_CONSOLIDATED',
        'This sale is already represented by a consolidated delivery document',
        409,
      );
    }

    if (sale.officialDocumentNumber) {
      return Object.freeze({
        saleId: sale.id,
        saleCode: sale.code,
        documentNumber: sale.officialDocumentNumber,
        replayed: true,
      });
    }

    const documentNumber = `DN-${sale.code}`;
    const changed = await tx.sale.updateMany({
      where: {
        id: normalizedSaleId,
        branchId: normalizedBranchId,
        status: { not: 'CANCELLED' },
        officialDocumentNumber: null,
      },
      data: { officialDocumentNumber: documentNumber },
    });

    if (changed.count !== 1) {
      const latest = await tx.sale.findFirst({
        where: { id: normalizedSaleId, branchId: normalizedBranchId },
        select: { officialDocumentNumber: true },
      });
      if (latest?.officialDocumentNumber) {
        return Object.freeze({
          saleId: sale.id,
          saleCode: sale.code,
          documentNumber: latest.officialDocumentNumber,
          replayed: true,
        });
      }
      fail('DELIVERY_NOTE_ISSUANCE_CONFLICT', 'Delivery note issuance conflicted with a concurrent sale update', 409);
    }

    return Object.freeze({
      saleId: sale.id,
      saleCode: sale.code,
      documentNumber,
      replayed: false,
    });
  });
};

module.exports = Object.freeze({ issueSaleDeliveryNote });
