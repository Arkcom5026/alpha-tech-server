'use strict';

const { prisma } = require('../../../../../lib/prisma');
const { registerTaxCandidate } = require('../../intake/registerTaxCandidateService');
const { convertTaxCandidate } = require('../../candidates/conversion/convertTaxCandidateService');

const positiveInteger = (value, code, fieldName) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive integer`), {
      code,
      statusCode: 400,
    });
  }
  return number;
};

const money = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const registerPurchaseReceiptTaxCandidate = async ({
  branchId,
  receipt,
  actorEmployeeId,
}) => {
  const normalizedBranchId = positiveInteger(branchId, 'TAX_BRANCH_REQUIRED', 'branchId');
  const receiptId = positiveInteger(receipt?.id, 'TAX_PURCHASE_RECEIPT_ID_REQUIRED', 'receipt.id');
  const supplierId = positiveInteger(receipt?.supplierId, 'TAX_PURCHASE_RECEIPT_SUPPLIER_REQUIRED', 'receipt.supplierId');
  const status = String(receipt?.status || '').trim().toUpperCase();
  const taxMode = String(receipt?.taxDocumentMode || '').trim().toUpperCase();
  const documentNumber = String(receipt?.supplierTaxInvoiceNumber || '').trim();

  if (status !== 'COMPLETED') {
    throw Object.assign(new Error('Quick receipt is not completed'), {
      code: 'TAX_PURCHASE_RECEIPT_NOT_READY',
      statusCode: 409,
    });
  }
  if (taxMode !== 'RECEIVED_WITH_GOODS') {
    throw Object.assign(new Error('Quick receipt has no received tax invoice'), {
      code: 'TAX_PURCHASE_RECEIPT_DOCUMENT_NOT_RECEIVED',
      statusCode: 409,
    });
  }
  if (!documentNumber || !receipt?.supplierTaxInvoiceDate) {
    throw Object.assign(new Error('Supplier tax invoice number and date are required'), {
      code: 'TAX_PURCHASE_RECEIPT_DOCUMENT_REQUIRED',
      statusCode: 400,
    });
  }

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, branchId: normalizedBranchId },
    select: { id: true, name: true, taxId: true, taxBranchCode: true },
  });
  if (!supplier) {
    throw Object.assign(new Error('Supplier not found'), {
      code: 'TAX_SOURCE_SUPPLIER_NOT_FOUND',
      statusCode: 404,
    });
  }

  const registration = await registerTaxCandidate({
    branchId: normalizedBranchId,
    sourceType: 'PURCHASE_RECEIPT',
    sourceId: `QUICK_RECEIPT:${receiptId}`,
    sourceDocumentNo: documentNumber,
    occurredAt: receipt.completedAt || receipt.supplierTaxInvoiceDate,
    actorEmployeeId,
    documentType: 'INPUT_TAX_INVOICE',
    snapshot: {
      quickReceiptId: receiptId,
      quickReceiptCode: receipt.code || null,
      supplierId,
      counterpartyName: supplier.name,
      counterpartyTaxId: supplier.taxId || null,
      supplierTaxBranchCode: supplier.taxBranchCode || null,
      deliveryNoteNumber: receipt.deliveryNoteNumber || null,
      deliveryNoteDate: receipt.deliveryNoteDate || null,
      supplierTaxInvoiceNumber: documentNumber,
      supplierTaxInvoiceDate: receipt.supplierTaxInvoiceDate,
      taxPricingMode: receipt.taxPricingMode || null,
      subtotalAmount: money(receipt.documentSubtotal),
      taxAmount: money(receipt.documentVatAmount),
      totalAmount: money(receipt.documentTotalAmount),
      currency: 'THB',
      issuedAt: receipt.supplierTaxInvoiceDate,
    },
  });

  return convertTaxCandidate({
    branchId: normalizedBranchId,
    candidateId: registration.candidate.id,
    documentType: 'INPUT_TAX_INVOICE',
    actorEmployeeId,
  });
};

module.exports = Object.freeze({ registerPurchaseReceiptTaxCandidate });
