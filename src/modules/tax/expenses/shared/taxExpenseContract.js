'use strict';

const VALID_STATUSES = Object.freeze(['DRAFT', 'RECORDED', 'UNDER_REVIEW', 'FINALIZED', 'VOIDED']);
const VALID_COUNTERPARTIES = Object.freeze(['SUPPLIER', 'OTHER']);

const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const text = (value, field, { required = false, max = 500 } = {}) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (required) fail('TAX_EXPENSE_VALIDATION_ERROR', `${field} is required`);
    return null;
  }
  const normalized = String(value).trim();
  if (normalized.length > max) fail('TAX_EXPENSE_VALIDATION_ERROR', `${field} is too long`);
  return normalized;
};

const amount = (value, field, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) fail('TAX_EXPENSE_VALIDATION_ERROR', `${field} is required`);
    return 0;
  }
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) {
    fail('TAX_EXPENSE_VALIDATION_ERROR', `${field} must be a non-negative number`);
  }
  return Number(normalized.toFixed(2));
};

const date = (value, field, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) fail('TAX_EXPENSE_VALIDATION_ERROR', `${field} is required`);
    return null;
  }
  const normalized = new Date(value);
  if (Number.isNaN(normalized.getTime())) fail('TAX_EXPENSE_VALIDATION_ERROR', `${field} is invalid`);
  return normalized;
};

const positiveInteger = (value, field, { required = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (required) fail('TAX_EXPENSE_VALIDATION_ERROR', `${field} is required`);
    return null;
  }
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    fail('TAX_EXPENSE_VALIDATION_ERROR', `${field} must be a positive integer`);
  }
  return normalized;
};

const normalizeCategoryInput = (input = {}) => ({
  code: text(input.code, 'code', { required: true, max: 64 }).toUpperCase(),
  name: text(input.name, 'name', { required: true, max: 160 }),
});

const normalizeExpenseItems = (input) => {
  if (!Array.isArray(input) || input.length === 0) {
    fail('TAX_EXPENSE_ITEMS_REQUIRED', 'At least one expense item is required');
  }

  return input.map((item, index) => {
    const quantity = amount(item?.quantity, `items[${index}].quantity`, { required: true });
    if (quantity <= 0) fail('TAX_EXPENSE_VALIDATION_ERROR', `items[${index}].quantity must be greater than zero`);
    const unitAmount = amount(item?.unitAmount, `items[${index}].unitAmount`, { required: true });
    const computedSubtotal = Number((quantity * unitAmount).toFixed(2));
    const suppliedSubtotal = item?.subtotalAmount === undefined || item?.subtotalAmount === null || item?.subtotalAmount === ''
      ? computedSubtotal
      : amount(item.subtotalAmount, `items[${index}].subtotalAmount`, { required: true });

    if (suppliedSubtotal !== computedSubtotal) {
      fail('TAX_EXPENSE_LINE_TOTAL_MISMATCH', `items[${index}].subtotalAmount must equal quantity × unitAmount`);
    }

    return {
      categoryId: positiveInteger(item?.categoryId, `items[${index}].categoryId`, { required: true }),
      lineNumber: index + 1,
      description: text(item?.description, `items[${index}].description`, { required: true, max: 1000 }),
      quantity,
      unitAmount,
      subtotalAmount: computedSubtotal,
      vatAmount: amount(item?.vatAmount, `items[${index}].vatAmount`),
      withholdingTaxRate: item?.withholdingTaxRate === undefined || item?.withholdingTaxRate === null || item?.withholdingTaxRate === ''
        ? null
        : amount(item.withholdingTaxRate, `items[${index}].withholdingTaxRate`),
      withholdingTaxAmount: amount(item?.withholdingTaxAmount, `items[${index}].withholdingTaxAmount`),
    };
  });
};

const normalizeCreateExpenseInput = (input = {}) => {
  const counterpartyType = text(input.counterpartyType || 'OTHER', 'counterpartyType', { required: true, max: 32 }).toUpperCase();
  if (!VALID_COUNTERPARTIES.includes(counterpartyType)) {
    fail('TAX_EXPENSE_VALIDATION_ERROR', 'counterpartyType is unsupported');
  }

  const supplierId = positiveInteger(input.supplierId, 'supplierId');
  if (counterpartyType === 'SUPPLIER' && !supplierId) {
    fail('TAX_EXPENSE_VALIDATION_ERROR', 'supplierId is required for SUPPLIER counterparty');
  }

  const items = normalizeExpenseItems(input.items);
  const subtotalAmount = Number(items.reduce((sum, item) => sum + item.subtotalAmount, 0).toFixed(2));
  const vatAmount = Number(items.reduce((sum, item) => sum + item.vatAmount, 0).toFixed(2));
  const withholdingTaxAmount = Number(items.reduce((sum, item) => sum + item.withholdingTaxAmount, 0).toFixed(2));
  const totalAmount = Number((subtotalAmount + vatAmount).toFixed(2));

  return {
    supplierId,
    counterpartyType,
    counterpartyName: text(input.counterpartyName, 'counterpartyName', { required: true, max: 255 }),
    counterpartyTaxId: text(input.counterpartyTaxId, 'counterpartyTaxId', { max: 64 }),
    documentNumber: text(input.documentNumber, 'documentNumber', { max: 128 }),
    documentDate: date(input.documentDate, 'documentDate'),
    expenseDate: date(input.expenseDate, 'expenseDate', { required: true }),
    receivedAt: date(input.receivedAt, 'receivedAt'),
    note: text(input.note, 'note', { max: 5000 }),
    items,
    subtotalAmount,
    vatAmount,
    totalAmount,
    withholdingTaxAmount,
    paymentDueAmount: Number(Math.max(0, totalAmount - withholdingTaxAmount).toFixed(2)),
  };
};

const normalizeListFilters = (input = {}) => {
  const status = input.status ? text(input.status, 'status', { required: true, max: 32 }).toUpperCase() : null;
  if (status && !VALID_STATUSES.includes(status)) fail('TAX_EXPENSE_VALIDATION_ERROR', 'status is unsupported');
  const fromDate = date(input.fromDate, 'fromDate');
  const toDate = date(input.toDate, 'toDate');
  if (fromDate && toDate && fromDate > toDate) fail('TAX_EXPENSE_VALIDATION_ERROR', 'fromDate must not be after toDate');
  return { status, supplierId: positiveInteger(input.supplierId, 'supplierId'), documentNumber: text(input.documentNumber, 'documentNumber', { max: 128 }), fromDate, toDate };
};

module.exports = Object.freeze({
  VALID_STATUSES,
  normalizeCategoryInput,
  normalizeCreateExpenseInput,
  normalizeListFilters,
  positiveInteger,
});
