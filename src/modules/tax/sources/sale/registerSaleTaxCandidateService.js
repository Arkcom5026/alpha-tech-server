'use strict';

const { prisma } = require('../../../../../lib/prisma');
const { registerTaxCandidate } = require('../../intake/registerTaxCandidateService');
const { convertTaxCandidate } = require('../../candidates/conversion/convertTaxCandidateService');
const { buildSaleTaxSnapshot } = require('./buildSaleTaxSnapshot');

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
      soldAt: true,
      branchId: true,
      customerId: true,
      employeeId: true,
      totalBeforeDiscount: true,
      totalDiscount: true,
      totalAmount: true,
      vat: true,
      vatRate: true,
      note: true,
      refCode: true,
      isTaxInvoice: true,
      dueDate: true,
      finalizedAt: true,
      isCredit: true,
      officialDocumentNumber: true,
      saleType: true,
      paid: true,
      paidAt: true,
      paidAmount: true,
      status: true,
      statusPayment: true,
      createdAt: true,
      updatedAt: true,
      branch: {
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          branchCode: true,
          isHeadOffice: true,
          taxId: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
          companyName: true,
          taxId: true,
          type: true,
          addressDetail: true,
          subdistrictCode: true,
          user: { select: { loginId: true } },
        },
      },
      items: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          stockItemId: true,
          basePrice: true,
          vatAmount: true,
          price: true,
          discount: true,
          remark: true,
          documentDescription: true,
          documentPrefix: true,
          documentSuffix: true,
          stockItem: {
            select: {
              id: true,
              barcode: true,
              serialNumber: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  saleBarcode: true,
                  unit: { select: { name: true } },
                },
              },
            },
          },
        },
      },
      simpleItems: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          productId: true,
          quantity: true,
          basePrice: true,
          discount: true,
          price: true,
          vatAmount: true,
          remark: true,
          simpleLotId: true,
          documentDescription: true,
          documentPrefix: true,
          documentSuffix: true,
          product: {
            select: {
              id: true,
              name: true,
              saleBarcode: true,
              unit: { select: { name: true } },
            },
          },
        },
      },
      payments: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          code: true,
          isCancelled: true,
          receivedAt: true,
          items: {
            select: {
              id: true,
              amount: true,
              paymentMethod: true,
              cardRef: true,
            },
          },
        },
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

  const snapshot = buildSaleTaxSnapshot({ sale });
  const registration = await registerTaxCandidate({
    branchId: normalizedBranchId,
    sourceType: 'SALE',
    sourceId: String(sale.id),
    sourceDocumentNo: sale.officialDocumentNumber || sale.code,
    occurredAt: sale.finalizedAt || sale.updatedAt || sale.createdAt,
    actorEmployeeId,
    snapshot: {
      ...snapshot,
      saleId: sale.id,
      saleCode: sale.code,
      customerId: sale.customerId,
      counterpartyName: snapshot.counterparty.displayName,
      counterpartyTaxId: snapshot.counterparty.taxId,
      customerType: snapshot.counterparty.customerType,
      isTaxInvoice: snapshot.commercial.isTaxInvoiceRequested,
      saleStatus: snapshot.source.status,
      paymentStatus: snapshot.commercial.paymentStatus,
      subtotalAmount: snapshot.totals.subtotalAmount,
      discountAmount: snapshot.totals.discountAmount,
      taxAmount: snapshot.totals.taxAmount,
      totalAmount: snapshot.totals.totalAmount,
      vatRate: snapshot.totals.vatRate,
      currency: snapshot.commercial.currency,
      issuedAt: sale.finalizedAt || sale.updatedAt || sale.createdAt,
    },
  });

  return convertTaxCandidate({
    branchId: normalizedBranchId,
    candidateId: registration.candidate.id,
    actorEmployeeId,
  });
};

module.exports = Object.freeze({ registerSaleTaxCandidate });
