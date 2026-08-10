'use strict';

const blockingCodes = (workspace = {}) => new Set(
  (Array.isArray(workspace.exceptions) ? workspace.exceptions : [])
    .filter((entry) => entry?.severity === 'BLOCKING')
    .map((entry) => String(entry.code || '')),
);

const deriveWithholdingTaxReadiness = (workspace = {}) => {
  const codes = blockingCodes(workspace);
  const rows = Array.isArray(workspace.rows) ? workspace.rows : [];
  const filings = Array.isArray(workspace.filings) ? workspace.filings : [];
  const hasWithholdingSource = rows.some((row) => (
    Number(row?.withholdingTaxAmount || 0) > 0
    || ['PENDING_REVIEW', 'WITHHOLDING_REQUIRED', 'WITHHELD'].includes(String(row?.whtTreatment || ''))
  ));
  const hasCertifiedSource = rows.some((row) => String(row?.certificateStatus || '') === 'ISSUED');

  const certificatesReady = !codes.has('WHT_ASSESSMENT_PENDING')
    && !codes.has('WHT_WITHHOLDING_NOT_COMPLETED')
    && !codes.has('WHT_CERTIFICATE_NOT_ISSUED');

  const filingBlocker = [...codes].some((code) => (
    code.startsWith('WHT_PND3_FILING_') || code.startsWith('WHT_PND53_FILING_')
  ));
  const submittedFilingCount = filings.filter((row) => (
    Number(row?.itemCount || 0) > 0 && String(row?.status || '') === 'SUBMITTED'
  )).length;
  const filingsReady = !filingBlocker
    && (!hasCertifiedSource || submittedFilingCount > 0);

  return Object.freeze({
    certificatesReady,
    filingsReady,
    readyForAccountant: certificatesReady && filingsReady && codes.size === 0,
    hasWithholdingSource,
    hasCertifiedSource,
    submittedFilingCount,
  });
};

const normalizeWithholdingTaxWorkspace = (workspace = {}) => Object.freeze({
  ...workspace,
  readiness: deriveWithholdingTaxReadiness(workspace),
});

module.exports = Object.freeze({
  deriveWithholdingTaxReadiness,
  normalizeWithholdingTaxWorkspace,
});
