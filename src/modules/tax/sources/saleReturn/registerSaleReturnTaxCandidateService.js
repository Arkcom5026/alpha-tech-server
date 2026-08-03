'use strict';

const { prisma } = require('../../../../../lib/prisma');
const { registerTaxCandidate } = require('../../intake/registerTaxCandidateService');

const requirePositiveInt = (value, code, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive integer`), { code, statusCode: 400 });
  }
  return parsed;
};

const toMoney = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : 0;
};

const calculateTaxFromInclusiveTotal = ({ totalAmount, vatRate }) => {
  const total = toMoney(totalAmount);
  const rate = Number(vatRate || 0);
  if (!Number.isFinite(rate) || rate < 0) {
    throw Object.assign(new Error('Sale VAT rate is invalid'), {
      code: 'TAX_SALE_RETURN_VAT_RATE_INVALID',
      statusCode: 409,
    });
  }

  const subtotalAmount = toMoney(total / (1 + (rate / 100)));
  return Object.freeze({
    subtotalAmount,
    taxAmount: toMoney(total - subtotalAmount),
    totalAmount: total,
    vatRate: rate,
  });
};

const registerSaleReturnTaxCandidate = async ({ branchId, saleReturnId, actorEmployeeId }) => {
  const normalizedBranchId = requirePositiveInt(branchId, 'TAX_BRANCH_REQUIRED', 'branchId');
  const normalizedSaleReturnId = requirePositiveInt(
    saleReturnId,
    'TAX_SALE_RETURN_ID_REQUIRED',
    'saleReturnId',
  );

  const saleReturn = await prisma.saleReturn.findFirst({
    where: { id: normalizedSaleReturnId, branchId: normalizedBranchId },
    select: {
      id: true,
      code: true,
      saleId: true,
      branchId: true,
      status: true,
      returnedAt: true,
      totalRefund: true,
      refundedAmount: true,
      deductedAmount: true,
      isFullyRefunded: true,
      sale: {
        select: {
          id: true,
          code: true,
          branchId: true,
          statusPayment: true,
          vatRate: true,
          customer: { select: { taxId: true } },
        },
      },
    },
  });

  if (!saleReturn) {
    throw Object.assign(new Error('Sale Return not found'), {
      code: 'TAX_SALE_RETURN_NOT_FOUND',
      statusCode: 404,
    });
  }
  if (String(saleReturn.status || '').toUpperCase() !== 'COMPLETED') {
    throw Object.assign(new Error('Sale Return is not completed'), {
      code: 'TAX_SALE_RETURN_NOT_COMPLETED',
      statusCode: 409,
    });
  }
  if (toMoney(saleReturn.deductedAmount) !== 0) {
    throw Object.assign(new Error('Deducted Sale Return requires tax review before Credit Note creation'), {
      code: 'TAX_SALE_RETURN_DEDUCTED_REFUND_REVIEW_REQUIRED',
      statusCode: 409,
    });
  }
  if (toMoney(saleReturn.totalRefund) <= 0 || !saleReturn.isFullyRefunded) {
    throw Object.assign(new Error('Only fully refunded Sale Return values can create a Credit Note candidate'), {
      code: 'TAX_SALE_RETURN_FULL_REFUND_REQUIRED',
      statusCode: 409,
    });
  }

  const originalTaxDocument = await prisma.taxDocument.findFirst({
    where: {
      branchId: normalizedBranchId,
      status: 'APPROVED',
      candidate: {
        sourceType: 'SALE',
        sourceId: String(saleReturn.saleId),
      },
    },
    select: {
      id: true,
      documentType: true,
      documentNumber: true,
      identityKey: true,
      occurredAt: true,
      issuedAt: true,
      currency: true,
      counterpartyTaxId: true,
      snapshot: true,
    },
    orderBy: { id: 'desc' },
  });

  if (!originalTaxDocument) {
    throw Object.assign(new Error('An approved original sale Tax Document is required before Credit Note candidate creation'), {
      code: 'TAX_SALE_RETURN_ORIGINAL_TAX_DOCUMENT_NOT_FOUND',
      statusCode: 409,
    });
  }

  const amounts = calculateTaxFromInclusiveTotal({
    totalAmount: saleReturn.totalRefund,
    vatRate: saleReturn.sale.vatRate,
  });

  return registerTaxCandidate({
    branchId: normalizedBranchId,
    sourceType: 'SALE_RETURN',
    sourceId: String(saleReturn.id),
    sourceDocumentNo: saleReturn.code,
    occurredAt: saleReturn.returnedAt,
    actorEmployeeId,
    documentType: 'CREDIT_NOTE',
    snapshot: {
      saleReturnId: saleReturn.id,
      saleReturnCode: saleReturn.code,
      originalSaleId: saleReturn.sale.id,
      originalSaleCode: saleReturn.sale.code,
      originalTaxDocumentId: originalTaxDocument.id,
      originalTaxDocumentNumber: originalTaxDocument.documentNumber,
      originalTaxDocumentType: originalTaxDocument.documentType,
      originalTaxDocumentIdentityKey: originalTaxDocument.identityKey,
      originalTaxDocumentIssuedAt: originalTaxDocument.issuedAt || originalTaxDocument.occurredAt,
      counterpartyTaxId: originalTaxDocument.counterpartyTaxId || saleReturn.sale.customer?.taxId || null,
      currency: originalTaxDocument.currency || 'THB',
      subtotalAmount: amounts.subtotalAmount,
      taxAmount: amounts.taxAmount,
      totalAmount: amounts.totalAmount,
      vatRate: amounts.vatRate,
      refundAmount: toMoney(saleReturn.refundedAmount),
      deductedAmount: toMoney(saleReturn.deductedAmount),
      taxAdjustmentState: 'CREDIT_NOTE_CANDIDATE',
    },
  });
};

module.exports = Object.freeze({
  calculateTaxFromInclusiveTotal,
  registerSaleReturnTaxCandidate,
});
