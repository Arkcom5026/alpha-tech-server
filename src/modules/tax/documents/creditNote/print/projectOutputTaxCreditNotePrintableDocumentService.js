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

const amount = (value) => Number(value || 0);

const mapLine = ({ id, quantity, basePrice, discount, price, vatAmount, description, productName, barcode = null }) => ({
  id: Number(id),
  description: String(description || productName || '').trim() || 'Sale item',
  quantity: amount(quantity || 1),
  unitAmount: amount(basePrice),
  discountAmount: amount(discount),
  lineAmount: amount(price),
  vatAmount: amount(vatAmount),
  barcode,
});

const projectOutputTaxCreditNotePrintableDocument = async ({ branchId, taxDocumentId }) => {
  const normalizedBranchId = positiveInt(branchId, 'TAX_BRANCH_REQUIRED', 'branchId');
  const normalizedDocumentId = positiveInt(taxDocumentId, 'TAX_DOCUMENT_ID_REQUIRED', 'taxDocumentId');

  const document = await prisma.taxDocument.findFirst({
    where: { id: normalizedDocumentId, branchId: normalizedBranchId },
    select: {
      id: true,
      branchId: true,
      documentType: true,
      status: true,
      issuedAt: true,
      issuedDocumentNumber: true,
      issuedSequence: true,
      issuerSnapshot: true,
      recipientSnapshot: true,
      subtotalAmount: true,
      taxAmount: true,
      totalAmount: true,
      currency: true,
      originalTaxDocument: {
        select: {
          id: true,
          branchId: true,
          documentType: true,
          status: true,
          taxInvoiceKind: true,
          issuedAt: true,
          issuedDocumentNumber: true,
          candidate: { select: { sourceType: true, sourceId: true } },
        },
      },
      saleReturn: {
        select: {
          id: true,
          branchId: true,
          saleId: true,
          status: true,
          completedAt: true,
          refundedAmount: true,
          deductedAmount: true,
          isFullyRefunded: true,
        },
      },
    },
  });

  if (!document) fail('TAX_DOCUMENT_NOT_FOUND', 'Tax document not found', 404);
  if (
    document.documentType !== 'OUTPUT_TAX_CREDIT_NOTE'
    || document.status !== 'REGISTERED'
    || !document.issuerSnapshot
    || !document.issuedDocumentNumber
    || !document.originalTaxDocument
    || !document.saleReturn
  ) {
    fail('TAX_CREDIT_NOTE_NOT_PRINTABLE', 'Only a registered issued credit note may be printed', 409);
  }

  const original = document.originalTaxDocument;
  const saleReturn = document.saleReturn;
  if (
    original.branchId !== normalizedBranchId
    || saleReturn.branchId !== normalizedBranchId
    || original.documentType !== 'OUTPUT_TAX_INVOICE'
    || original.status !== 'REGISTERED'
    || original.candidate?.sourceType !== 'SALE'
    || Number(original.candidate.sourceId) !== Number(saleReturn.saleId)
    || saleReturn.status !== 'COMPLETED'
    || saleReturn.isFullyRefunded !== true
    || amount(saleReturn.deductedAmount) !== 0
    || amount(saleReturn.refundedAmount) !== amount(original.totalAmount)
  ) {
    fail('TAX_CREDIT_NOTE_PROJECTION_INTEGRITY_FAILED', 'Credit-note links no longer meet full-return requirements', 409);
  }

  const saleId = positiveInt(original.candidate.sourceId, 'TAX_SOURCE_SALE_NOT_FOUND', 'saleId');
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, branchId: normalizedBranchId },
    select: {
      id: true,
      code: true,
      soldAt: true,
      customer: {
        select: { name: true, companyName: true, departmentName: true, taxId: true },
      },
      items: {
        select: {
          id: true,
          basePrice: true,
          discount: true,
          price: true,
          vatAmount: true,
          documentDescription: true,
          stockItem: {
            select: {
              barcode: true,
              product: { select: { name: true } },
            },
          },
        },
      },
      simpleItems: {
        select: {
          id: true,
          quantity: true,
          basePrice: true,
          discount: true,
          price: true,
          vatAmount: true,
          documentDescription: true,
          product: { select: { name: true } },
        },
      },
    },
  });
  if (!sale) fail('TAX_SOURCE_SALE_NOT_FOUND', 'Sale not found', 404);

  const lines = [
    ...sale.items.map((item) => mapLine({
      ...item,
      quantity: 1,
      description: item.documentDescription,
      productName: item.stockItem.product.name,
      barcode: item.stockItem.barcode,
    })),
    ...sale.simpleItems.map((item) => mapLine({
      ...item,
      description: item.documentDescription,
      productName: item.product.name,
    })),
  ];

  return Object.freeze({
    document: {
      id: document.id,
      type: 'CREDIT_NOTE',
      title: 'ใบลดหนี้',
      number: document.issuedDocumentNumber,
      sequence: Number(document.issuedSequence),
      issuedAt: document.issuedAt,
      currency: document.currency,
      subtotalAmount: amount(document.subtotalAmount),
      taxAmount: amount(document.taxAmount),
      totalAmount: amount(document.totalAmount),
    },
    issuer: document.issuerSnapshot,
    recipient: document.recipientSnapshot || null,
    originalInvoice: {
      id: original.id,
      kind: original.taxInvoiceKind,
      number: original.issuedDocumentNumber,
      issuedAt: original.issuedAt,
    },
    saleReturn: {
      id: saleReturn.id,
      completedAt: saleReturn.completedAt,
      refundedAmount: amount(saleReturn.refundedAmount),
    },
    sale: {
      id: sale.id,
      code: sale.code,
      soldAt: sale.soldAt,
      branchId: normalizedBranchId,
      customerName: sale.customer?.companyName || sale.customer?.name || null,
      customerTaxId: sale.customer?.taxId || null,
    },
    lines,
  });
};

module.exports = Object.freeze({ projectOutputTaxCreditNotePrintableDocument });
