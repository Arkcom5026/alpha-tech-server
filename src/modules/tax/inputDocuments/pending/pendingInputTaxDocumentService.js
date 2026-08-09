'use strict';

const repository = require('./pendingInputTaxDocumentRepository');
const { resolveInputTaxReceiptVatPolicy } = require('./inputTaxReceiptVatPolicy');

const SOURCE_TYPES = Object.freeze(['PO_RECEIPT', 'QUICK_RECEIPT']);
const LINK_STATES = Object.freeze(['ACTION_REQUIRED', 'UNLINKED', 'PARTIALLY_LINKED', 'LINKED']);

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

const listPendingInputTaxDocuments = async (input = {}) => {
  const requestedSource = String(input.sourceType || '').trim().toUpperCase();
  if (requestedSource && !SOURCE_TYPES.includes(requestedSource)) {
    throw Object.assign(new Error('sourceType must be PO_RECEIPT or QUICK_RECEIPT'), {
      code: 'PENDING_INPUT_TAX_SOURCE_INVALID', statusCode: 400,
    });
  }
  const requestedLinkState = String(input.linkState || 'ACTION_REQUIRED').trim().toUpperCase();
  if (requestedLinkState && !LINK_STATES.includes(requestedLinkState)) {
    throw Object.assign(new Error('linkState must be ACTION_REQUIRED, UNLINKED, PARTIALLY_LINKED, or LINKED'), {
      code: 'PENDING_INPUT_TAX_LINK_STATE_INVALID', statusCode: 400,
    });
  }

  const result = await repository.listPending({
    branchId: positiveInt(input.branchId, 'TAX_BRANCH_REQUIRED', 'branchId'),
    sourceType: requestedSource || null,
    supplierId: positiveInt(input.supplierId, 'PENDING_INPUT_TAX_SUPPLIER_INVALID', 'supplierId', false),
    linkState: requestedLinkState || null,
    keyword: String(input.keyword || '').trim(),
    fromDate: parseDate(input.fromDate, 'fromDate'),
    toDateExclusive: parseDate(input.toDate, 'toDate', true),
    limit: input.limit, offset: input.offset,
  });

  return {
    ...result,
    items: (result.items || []).map((item) => ({
      ...item,
      vatPolicy: resolveInputTaxReceiptVatPolicy(item),
    })),
  };
};

module.exports = Object.freeze({ LINK_STATES, SOURCE_TYPES, listPendingInputTaxDocuments });
