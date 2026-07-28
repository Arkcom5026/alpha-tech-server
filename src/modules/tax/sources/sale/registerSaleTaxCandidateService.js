'use strict';

const { prisma } = require('../../../../../lib/prisma');
const { registerTaxCandidate } = require('../../intake/registerTaxCandidateService');
const { convertTaxCandidate } = require('../../candidates/conversion/convertTaxCandidateService');

const registerSaleTaxCandidate = async ({ branchId, saleId, actorEmployeeId }) => {
  const normalizedBranchId = Number(branchId);
  const normalizedSaleId = Number(saleId);

  if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
    throw Object.assign(new Error('branchId must be a positive integer'), { code: 'TAX_BRANCH_REQUIRED', statusCode: 400 });
  }
  if (!Number.isInteger(normalizedSaleId) || normalizedSaleId <= 0) {
    throw Object.assign(new Error('saleId must be a positive integer'), { code: 'TAX_SALE_ID_REQUIRED', statusCode: 400 });
  }

  const sale = await prisma.sale.findFirst({
    where: { id: normalizedSaleId, branchId: normalizedBranchId },
    select: {
      id: true,
      code: true,
      branchId: true,
      customerId: true,
      totalBeforeDiscount: true,
      totalDiscount: true,
      totalAmount: true,
      vat: true,
      vatRate: true,
      isTaxInvoice: true,
      status: true,
      statusPayment: true,
      createdAt: true,
      updatedAt: true,
      customer: {
        select: { name: true, companyName: true, taxId: true, type: true },
      },
    },
  });

  if (!sale) {
    throw Object.assign(new Error('Sale not found'), { code: 'TAX_SOURCE_SALE_NOT_FOUND', statusCode: 404 });
  }
  if (!['COMPLETED', 'FINALIZED', 'DELIVERED'].includes(String(sale.status || '').toUpperCase())) {
    throw Object.assign(new Error('Sale is not ready for tax intake'), {
      code: 'TAX_SOURCE_SALE_NOT_READY',
      statusCode: 409,
    });
  }

  const gross = Number(sale.totalAmount || 0);
  const taxAmount = Number(sale.vat || 0);
  const subtotalAmount = Math.max(0, gross - taxAmount);

  const registration = await registerTaxCandidate({
    branchId: normalizedBranchId,
    sourceType: 'SALE',
    sourceId: String(sale.id),
    sourceDocumentNo: sale.code,
    occurredAt: sale.updatedAt || sale.createdAt,
    actorEmployeeId,
    snapshot: {
      saleId: sale.id,
      saleCode: sale.code,
      customerId: sale.customerId,
      counterpartyName: sale.customer?.companyName || sale.customer?.name || null,
      counterpartyTaxId: sale.customer?.taxId || null,
      customerType: sale.customer?.type || null,
      isTaxInvoice: Boolean(sale.isTaxInvoice),
      saleStatus: sale.status,
      paymentStatus: sale.statusPayment,
      subtotalAmount,
      discountAmount: Number(sale.totalDiscount || 0),
      taxAmount,
      totalAmount: gross,
      vatRate: Number(sale.vatRate || 0),
      currency: 'THB',
      issuedAt: sale.updatedAt || sale.createdAt,
    },
  });

  return convertTaxCandidate({
    branchId: normalizedBranchId,
    candidateId: registration.candidate.id,
    actorEmployeeId,
  });
};

module.exports = Object.freeze({ registerSaleTaxCandidate });
