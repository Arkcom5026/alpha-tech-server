'use strict';

const repository = require('../shared/taxIssuerProfileRepository');

const EDITABLE_FIELDS = new Set([
  'legalName',
  'taxId',
  'registeredAddress',
  'branchCode',
  'isHeadOffice',
  'shortTaxInvoicePrefix',
  'fullTaxInvoicePrefix',
  'creditNotePrefix',
  'status',
]);

const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const normalizeBranchId = (value) => {
  const branchId = Number(value);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    fail('TAX_ISSUER_PROFILE_BRANCH_REQUIRED', 'branchId must be a positive integer');
  }
  return branchId;
};

const optionalText = (value, field, maxLength = 5000) => {
  if (value === null) return null;
  if (typeof value !== 'string') fail('TAX_ISSUER_PROFILE_INVALID_FIELD', `${field} must be text`);
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    fail('TAX_ISSUER_PROFILE_INVALID_FIELD', `${field} is too long`);
  }
  return normalized || null;
};

const normalizeTaxId = (value) => {
  if (value === null) return null;
  const normalized = String(value).replace(/[^0-9]/g, '');
  if (normalized.length !== 13) {
    fail('TAX_ISSUER_PROFILE_INVALID_TAX_ID', 'taxId must contain exactly 13 digits');
  }
  return normalized;
};

const normalizeBranchCode = (value) => {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  if (!/^[0-9]{5}$/.test(normalized)) {
    fail('TAX_ISSUER_PROFILE_INVALID_BRANCH_CODE', 'branchCode must contain exactly 5 digits');
  }
  return normalized;
};

const normalizeStatus = (value) => {
  if (value === undefined) return undefined;
  const status = String(value || '').trim().toUpperCase();
  if (!['DRAFT', 'ACTIVE', 'SUSPENDED'].includes(status)) {
    fail('TAX_ISSUER_PROFILE_INVALID_STATUS', 'status must be DRAFT, ACTIVE, or SUSPENDED');
  }
  return status;
};

const normalizeData = (input = {}) => {
  const data = {};
  for (const field of Object.keys(input)) {
    if (!EDITABLE_FIELDS.has(field) && field !== 'branchId') {
      fail('TAX_ISSUER_PROFILE_FIELD_FORBIDDEN', `${field} cannot be changed through issuer-profile configuration`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'legalName')) {
    data.legalName = optionalText(input.legalName, 'legalName', 500);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'registeredAddress')) {
    data.registeredAddress = optionalText(input.registeredAddress, 'registeredAddress', 5000);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'shortTaxInvoicePrefix')) {
    data.shortTaxInvoicePrefix = optionalText(input.shortTaxInvoicePrefix, 'shortTaxInvoicePrefix', 100);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'fullTaxInvoicePrefix')) {
    data.fullTaxInvoicePrefix = optionalText(input.fullTaxInvoicePrefix, 'fullTaxInvoicePrefix', 100);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'creditNotePrefix')) {
    data.creditNotePrefix = optionalText(input.creditNotePrefix, 'creditNotePrefix', 100);
  }
  if (Object.prototype.hasOwnProperty.call(input, 'taxId')) data.taxId = normalizeTaxId(input.taxId);
  if (Object.prototype.hasOwnProperty.call(input, 'branchCode')) data.branchCode = normalizeBranchCode(input.branchCode);
  if (Object.prototype.hasOwnProperty.call(input, 'status')) data.status = normalizeStatus(input.status);
  if (Object.prototype.hasOwnProperty.call(input, 'isHeadOffice')) {
    if (typeof input.isHeadOffice !== 'boolean') {
      fail('TAX_ISSUER_PROFILE_INVALID_FIELD', 'isHeadOffice must be boolean');
    }
    data.isHeadOffice = input.isHeadOffice;
  }
  return data;
};

const assertActiveProfileComplete = (profile) => {
  const missing = [];
  if (!profile.legalName) missing.push('legalName');
  if (!profile.taxId) missing.push('taxId');
  if (!profile.registeredAddress) missing.push('registeredAddress');
  if (!profile.branchCode) missing.push('branchCode');
  if (missing.length) {
    fail(
      'TAX_ISSUER_PROFILE_ACTIVATION_INCOMPLETE',
      `Active tax issuer profile requires: ${missing.join(', ')}`,
      409,
    );
  }
};

const upsertTaxIssuerProfile = async ({ branchId, ...input }) => {
  const normalizedBranchId = normalizeBranchId(branchId);
  const current = await repository.findByBranchId(normalizedBranchId);
  const data = normalizeData(input);
  const candidate = { ...(current || { branchId: normalizedBranchId, branchCode: '00000' }), ...data };
  if (candidate.status === 'ACTIVE') assertActiveProfileComplete(candidate);

  const profile = await repository.upsert({ branchId: normalizedBranchId, data });
  return { created: !current, profile };
};

module.exports = Object.freeze({
  upsertTaxIssuerProfile,
});
