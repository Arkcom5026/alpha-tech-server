'use strict';

const fail = (message, code = 'QUOTATION_VALIDATION_FAILED', status = 400) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  throw error;
};

const positiveInt = (value, name) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail(`${name} is required`, 'QUOTATION_CONTEXT_REQUIRED', 401);
  return parsed;
};

const optionalPositiveInt = (value, name) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail(`${name} is invalid`);
  return parsed;
};

const text = (value, max = 5000) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  if (normalized.length > max) fail(`Text exceeds ${max} characters`);
  return normalized;
};

const money = (value, name, { min = 0 } = {}) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < min) fail(`${name} is invalid`);
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
};

const quantity = (value) => {
  const parsed = Number(value ?? 1);
  if (!Number.isInteger(parsed) || parsed <= 0) fail('quantity must be a positive integer');
  return parsed;
};

const bool = (value, fallback = false) => value === undefined ? fallback : Boolean(value);

const date = (value, name) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) fail(`${name} is invalid`);
  return parsed;
};

const draftPatch = (input = {}) => ({
  customerId: optionalPositiveInt(input.customerId, 'customerId'),
  subject: text(input.subject, 500),
  introduction: text(input.introduction, 10000),
  closingNote: text(input.closingNote, 10000),
  notes: text(input.notes, 10000),
  paymentTerms: text(input.paymentTerms, 1000),
  customerName: text(input.customerName, 500),
  customerCompany: text(input.customerCompany, 500),
  customerDepartment: text(input.customerDepartment, 500),
  customerContactName: text(input.customerContactName, 500),
  customerPhone: text(input.customerPhone, 100),
  customerTaxId: text(input.customerTaxId, 100),
  customerAddress: text(input.customerAddress, 3000),
  issueDate: date(input.issueDate, 'issueDate'),
  validUntil: date(input.validUntil, 'validUntil'),
  // Quotation uses the offered unit price as the final commercial price.
  // Discount fields remain in the schema only for backward compatibility.
  billDiscount: 0,
  vatEnabled: bool(input.vatEnabled, true),
  vatRate: money(input.vatRate ?? 7, 'vatRate'),
});

const linePayload = (input = {}) => {
  const title = text(input.title, 1000);
  if (!title) fail('title is required', 'QUOTATION_LINE_TITLE_REQUIRED');
  const sourceProductId = optionalPositiveInt(input.sourceProductId, 'sourceProductId');
  return {
    sourceType: sourceProductId ? 'PRODUCT_ASSISTED' : 'MANUAL',
    sourceProductId,
    title,
    description: text(input.description, 10000),
    quantity: quantity(input.quantity),
    unitName: text(input.unitName, 100),
    unitPrice: money(input.unitPrice, 'unitPrice'),
    discountAmount: 0,
    sortOrder: Number.isInteger(Number(input.sortOrder)) ? Number(input.sortOrder) : 0,
  };
};

module.exports = Object.freeze({
  bool,
  date,
  draftPatch,
  fail,
  linePayload,
  money,
  optionalPositiveInt,
  positiveInt,
  quantity,
  text,
});