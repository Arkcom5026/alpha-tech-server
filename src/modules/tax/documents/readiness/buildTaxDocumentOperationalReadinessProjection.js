'use strict';

const normalizeStatus = (value) => String(value || '').trim().toUpperCase();
const normalizeNumber = (value) => (value == null ? null : Number(value));
const hasText = (value) => Boolean(String(value || '').trim());

const buildTaxDocumentOperationalReadinessProjection = ({ document }) => {
  if (!document) {
    throw Object.assign(new Error('Tax document is required'), {
      code: 'TAX_DOCUMENT_REQUIRED',
      statusCode: 400,
    });
  }

  const snapshot = document.snapshot || {};
  const status = normalizeStatus(document.status);
  const documentType = normalizeStatus(document.documentType);
  const lines = Array.isArray(snapshot.lines) ? snapshot.lines : [];
  const counterparty = snapshot.counterparty || {};
  const issuer = snapshot.issuer || {};
  const totals = snapshot.totals || {};

  const checks = [
    {
      code: 'DOCUMENT_TYPE_PRESENT',
      passed: hasText(documentType),
      blocking: true,
      message: hasText(documentType) ? null : 'Document type is required',
    },
    {
      code: 'ISSUER_IDENTITY_PRESENT',
      passed: hasText(issuer.branchName) || hasText(issuer.taxId),
      blocking: true,
      message: hasText(issuer.branchName) || hasText(issuer.taxId) ? null : 'Issuer identity is missing from snapshot',
    },
    {
      code: 'COUNTERPARTY_IDENTITY_PRESENT',
      passed: hasText(counterparty.displayName) || hasText(counterparty.name) || hasText(counterparty.companyName),
      blocking: documentType.includes('FULL'),
      message:
        hasText(counterparty.displayName) || hasText(counterparty.name) || hasText(counterparty.companyName)
          ? null
          : 'Counterparty identity is missing from snapshot',
    },
    {
      code: 'COUNTERPARTY_TAX_ID_PRESENT',
      passed: hasText(document.counterpartyTaxId) || hasText(counterparty.taxId),
      blocking: documentType.includes('FULL'),
      message:
        hasText(document.counterpartyTaxId) || hasText(counterparty.taxId)
          ? null
          : 'Counterparty tax ID is required for full tax documents',
    },
    {
      code: 'DOCUMENT_LINES_PRESENT',
      passed: lines.length > 0,
      blocking: true,
      message: lines.length > 0 ? null : 'At least one document line is required',
    },
    {
      code: 'TOTAL_AMOUNT_VALID',
      passed: Number(document.totalAmount ?? totals.totalAmount ?? 0) >= 0,
      blocking: true,
      message: Number(document.totalAmount ?? totals.totalAmount ?? 0) >= 0 ? null : 'Total amount must not be negative',
    },
    {
      code: 'ISSUANCE_STATUS_ALLOWED',
      passed: ['DRAFT', 'APPROVED', 'ISSUED'].includes(status),
      blocking: true,
      message: ['DRAFT', 'APPROVED', 'ISSUED'].includes(status)
        ? null
        : `Document in status ${status || 'UNKNOWN'} cannot be issued`,
    },
    {
      code: 'PRINTABLE_STATUS_ALLOWED',
      passed: status === 'ISSUED',
      blocking: false,
      message: status === 'ISSUED' ? null : 'Document must be issued before final printing',
    },
  ];

  const blockingFailures = checks.filter((check) => check.blocking && !check.passed);
  const warnings = checks.filter((check) => !check.blocking && !check.passed);

  return Object.freeze({
    schemaVersion: 'TAX_DOCUMENT_OPERATIONAL_READINESS_PROJECTION_V1',
    taxDocumentId: normalizeNumber(document.id),
    branchId: normalizeNumber(document.branchId),
    documentType: document.documentType || null,
    documentNumber: document.documentNumber || null,
    status: document.status || null,
    canIssue: blockingFailures.length === 0 && status !== 'ISSUED',
    canPrintFinal: blockingFailures.length === 0 && status === 'ISSUED',
    canCancel: status === 'ISSUED',
    canReplace: status === 'CANCELLED',
    blockingFailureCount: blockingFailures.length,
    warningCount: warnings.length,
    checks: Object.freeze(checks.map((check) => Object.freeze(check))),
  });
};

module.exports = Object.freeze({ buildTaxDocumentOperationalReadinessProjection });
