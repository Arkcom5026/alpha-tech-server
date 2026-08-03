'use strict';

const fail = (code, message) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 409;
  throw error;
};

const toId = (value, code) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) fail(code, 'A positive integer identity is required');
  return id;
};

const toMoney = (value, code) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) fail(code, 'A non-negative money amount is required');
  return amount;
};

const sameMoney = (left, right) => Math.abs(left - right) < 0.000001;

const assertOutputTaxCreditNoteEligibility = ({
  originalTaxDocument,
  saleReturn,
  sourceSaleId,
  isFullSaleReturn,
}) => {
  if (!originalTaxDocument || !saleReturn) {
    fail('TAX_CREDIT_NOTE_SOURCE_REQUIRED', 'An original tax document and sale return are required');
  }

  const branchId = toId(originalTaxDocument.branchId, 'TAX_CREDIT_NOTE_BRANCH_REQUIRED');
  const returnBranchId = toId(saleReturn.branchId, 'TAX_CREDIT_NOTE_BRANCH_REQUIRED');
  if (branchId !== returnBranchId) {
    fail('TAX_CREDIT_NOTE_TENANT_MISMATCH', 'The tax document and sale return must belong to the same branch');
  }

  if (originalTaxDocument.documentType !== 'OUTPUT_TAX_INVOICE') {
    fail('TAX_CREDIT_NOTE_ORIGINAL_DOCUMENT_INVALID', 'Only an output tax invoice can be credited');
  }
  if (originalTaxDocument.status !== 'REGISTERED' || !originalTaxDocument.issuerProfileId || !originalTaxDocument.issuedDocumentNumber) {
    fail('TAX_CREDIT_NOTE_ORIGINAL_NOT_ISSUED', 'The original tax invoice must be issued before a credit note');
  }

  const saleId = toId(sourceSaleId, 'TAX_CREDIT_NOTE_SALE_REQUIRED');
  if (toId(saleReturn.saleId, 'TAX_CREDIT_NOTE_SALE_REQUIRED') !== saleId) {
    fail('TAX_CREDIT_NOTE_SALE_MISMATCH', 'The sale return must reference the sale behind the original tax invoice');
  }
  if (saleReturn.status !== 'COMPLETED' || saleReturn.isFullyRefunded !== true || isFullSaleReturn !== true) {
    fail('TAX_CREDIT_NOTE_FULL_RETURN_REQUIRED', 'A completed full sale return with a full refund is required');
  }

  const originalTotal = toMoney(originalTaxDocument.totalAmount, 'TAX_CREDIT_NOTE_AMOUNT_INVALID');
  const refundedAmount = toMoney(saleReturn.refundedAmount, 'TAX_CREDIT_NOTE_AMOUNT_INVALID');
  const deductedAmount = toMoney(saleReturn.deductedAmount, 'TAX_CREDIT_NOTE_AMOUNT_INVALID');
  if (!sameMoney(refundedAmount, originalTotal) || !sameMoney(deductedAmount, 0)) {
    fail('TAX_CREDIT_NOTE_FULL_REFUND_REQUIRED', 'The sale return must refund the original tax invoice in full without deductions');
  }

  return Object.freeze({
    branchId,
    originalTaxDocumentId: toId(originalTaxDocument.id, 'TAX_CREDIT_NOTE_DOCUMENT_REQUIRED'),
    saleReturnId: toId(saleReturn.id, 'TAX_CREDIT_NOTE_RETURN_REQUIRED'),
    originalInvoiceNumber: String(originalTaxDocument.issuedDocumentNumber),
    taxInvoiceKind: originalTaxDocument.taxInvoiceKind,
  });
};

module.exports = Object.freeze({ assertOutputTaxCreditNoteEligibility });
