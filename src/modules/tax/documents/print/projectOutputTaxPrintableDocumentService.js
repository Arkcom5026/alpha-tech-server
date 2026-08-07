'use strict';

const { prisma } = require('../../../../../lib/prisma');
const { projectOutputTaxCreditNotePrintableDocument } = require('../creditNote/print/projectOutputTaxCreditNotePrintableDocumentService');
const {
  ResolvePrintDocumentPurposeService,
} = require('../../../document-purpose/resolve/resolvePrintDocumentPurposeService');

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

const projectOutputTaxPrintableDocument = async ({ branchId, taxDocumentId }) => {
  const normalizedBranchId = positiveInt(branchId, 'TAX_BRANCH_REQUIRED', 'branchId');
  const normalizedDocumentId = positiveInt(taxDocumentId, 'TAX_DOCUMENT_ID_REQUIRED', 'taxDocumentId');

  const documentType = await prisma.taxDocument.findFirst({
    where: { id: normalizedDocumentId, branchId: normalizedBranchId },
    select: { documentType: true },
  });
  if (documentType?.documentType === 'OUTPUT_TAX_CREDIT_NOTE') {
    return projectOutputTaxCreditNotePrintableDocument({
      branchId: normalizedBranchId,
      taxDocumentId: normalizedDocumentId,
    });
  }

  const document = await prisma.taxDocument.findFirst({
    where: { id: normalizedDocumentId, branchId: normalizedBranchId },
    select: {
      id: true,
      branchId: true,
      documentType: true,
      status: true,
      taxInvoiceKind: true,
      issuedAt: true,
      issuedDocumentNumber: true,
      issuedSequence: true,
      issuerSnapshot: true,
      recipientSnapshot: true,
      subtotalAmount: true,
      taxAmount: true,
      totalAmount: true,
      currency: true,
      candidate: {
        select: { sourceType: true, sourceId: true },
      },
    },
  });

  if (!document) fail('TAX_DOCUMENT_NOT_FOUND', 'Tax document not found', 404);
  if (
    document.documentType !== 'OUTPUT_TAX_INVOICE'
    || document.status !== 'REGISTERED'
    || !document.taxInvoiceKind
    || !document.issuerSnapshot
    || !document.issuedDocumentNumber
  ) {
    fail(
      'TAX_DOCUMENT_NOT_PRINTABLE',
      'Only a registered issued output tax document may be printed',
      409,
    );
  }
  if (document.candidate?.sourceType !== 'SALE') {
    fail('TAX_OUTPUT_PRINT_SOURCE_UNSUPPORTED', 'Output tax document must be sourced from a sale', 409);
  }

  const saleId = positiveInt(document.candidate.sourceId, 'TAX_SOURCE_SALE_NOT_FOUND', 'saleId');
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, branchId: normalizedBranchId },
    select: {
      id: true,
      code: true,
      soldAt: true,
      status: true,
      paid: true,
      statusPayment: true,
      customer: {
        select: { name: true, companyName: true, taxId: true },
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
  if (sale.paid !== true || sale.statusPayment !== 'PAID') {
    fail('TAX_OUTPUT_PRINT_PAYMENT_REQUIRED', 'A fully paid sale is required to print an output tax invoice', 409);
  }

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

  const invoiceKind = document.taxInvoiceKind;
  const recipient = invoiceKind === 'FULL' ? document.recipientSnapshot : null;
  if (invoiceKind === 'FULL' && !recipient) {
    fail('TAX_OUTPUT_PRINT_RECIPIENT_MISSING', 'Full tax invoice has no recipient snapshot', 409);
  }

  const purposeCode = invoiceKind === 'FULL'
    ? 'FULL_TAX_INVOICE'
    : 'SHORT_TAX_INVOICE';
  const purpose = await new ResolvePrintDocumentPurposeService().execute({
    branchId: normalizedBranchId,
    code: purposeCode,
  });

  return Object.freeze({
    document: {
      id: document.id,
      type: purpose.code,
      title: purpose.displayName,
      number: document.issuedDocumentNumber,
      sequence: Number(document.issuedSequence),
      issuedAt: document.issuedAt,
      currency: document.currency,
      subtotalAmount: amount(document.subtotalAmount),
      taxAmount: amount(document.taxAmount),
      totalAmount: amount(document.totalAmount),
    },
    issuer: document.issuerSnapshot,
    recipient,
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

module.exports = Object.freeze({ projectOutputTaxPrintableDocument });
