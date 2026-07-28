'use strict';

const repository = require('./pendingInputTaxDocumentRepository');
const SOURCE_TYPES = Object.freeze(['PO_RECEIPT', 'QUICK_RECEIPT']);

const positiveInt = (value, code, fieldName, required = true) => {
  if ((value === null || value === undefined || value === '') && !required) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive integer`), { code, statusCode: 400 });
  }
  return parsed;
};
const parseDate = (value, fieldName, exclusiveEnd = false) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error(`${fieldName} is invalid`), {
      code: 'PENDING_INPUT_TAX_DATE_INVALID', statusCode: 400, details: { fieldName },
    });
  }
  if (exclusiveEnd && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) date.setUTCDate(date.getUTCDate() + 1);
  return date;
};
const listPendingInputTaxDocuments = (input = {}) => {
  const requestedSource = String(input.sourceType || '').trim().toUpperCase();
  if (requestedSource && !SOURCE_TYPES.includes(requestedSource)) {
    throw Object.assign(new Error('sourceType must be PO_RECEIPT or QUICK_RECEIPT'), {
      code: 'PENDING_INPUT_TAX_SOURCE_INVALID', statusCode: 400,
    });
  }
  return repository.listPending({
    branchId: positiveInt(input.branchId, 'TAX_BRANCH_REQUIRED', 'branchId'),
    sourceType: requestedSource || null,
    supplierId: positiveInt(input.supplierId, 'PENDING_INPUT_TAX_SUPPLIER_INVALID', 'supplierId', false),
    keyword: String(input.keyword || '').trim(),
    fromDate: parseDate(input.fromDate, 'fromDate'),
    toDateExclusive: parseDate(input.toDate, 'toDate', true),
    limit: input.limit, offset: input.offset,
  });
};
module.exports = Object.freeze({ SOURCE_TYPES, listPendingInputTaxDocuments });
