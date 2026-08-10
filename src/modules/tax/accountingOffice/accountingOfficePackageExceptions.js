'use strict';

const blocker = ({ code, source, count = 1, message }) => Object.freeze({
  code,
  source,
  severity: 'BLOCKER',
  count: Number(count || 0),
  message,
});

const buildClosingExceptions = ({
  period,
  outputUnboundCount,
  outputFilingPrepared,
  outputFilingCoversAllDocuments,
  inputUnboundCount,
  inputFilingPrepared,
  inputFilingCoversAllDocuments,
  pendingAssessmentCount,
  missingEvidenceCount,
  withholdingPendingCount,
  missingWithholdingCertificateCount,
}) => {
  const exceptions = [];

  if (outputUnboundCount > 0) exceptions.push(blocker({
    code: 'OUTPUT_VAT_PERIOD_UNBOUND',
    source: 'OUTPUT_VAT',
    count: outputUnboundCount,
    message: 'Output VAT records remain unbound to the tax period',
  }));
  if (!outputFilingPrepared) exceptions.push(blocker({
    code: 'OUTPUT_VAT_FILING_NOT_PREPARED',
    source: 'OUTPUT_VAT',
    message: 'Sales tax filing has not been prepared for this period',
  }));
  else if (!outputFilingCoversAllDocuments) exceptions.push(blocker({
    code: 'OUTPUT_VAT_FILING_INCOMPLETE',
    source: 'OUTPUT_VAT',
    message: 'Sales tax filing does not cover every Output VAT record in this period',
  }));

  if (inputUnboundCount > 0) exceptions.push(blocker({
    code: 'INPUT_VAT_PERIOD_UNBOUND',
    source: 'INPUT_VAT',
    count: inputUnboundCount,
    message: 'Input VAT records remain unbound to the tax period',
  }));
  if (!inputFilingPrepared) exceptions.push(blocker({
    code: 'INPUT_VAT_FILING_NOT_PREPARED',
    source: 'INPUT_VAT',
    message: 'Input tax filing has not been prepared for this period',
  }));
  else if (!inputFilingCoversAllDocuments) exceptions.push(blocker({
    code: 'INPUT_VAT_FILING_INCOMPLETE',
    source: 'INPUT_VAT',
    message: 'Input tax filing does not cover every Input VAT record in this period',
  }));

  if (pendingAssessmentCount > 0) exceptions.push(blocker({
    code: 'TAX_EXPENSE_ASSESSMENT_PENDING',
    source: 'TAX_EXPENSE',
    count: pendingAssessmentCount,
    message: 'Tax expenses remain pending VAT/CIT/WHT assessment',
  }));
  if (missingEvidenceCount > 0) exceptions.push(blocker({
    code: 'TAX_EXPENSE_EVIDENCE_INCOMPLETE',
    source: 'TAX_EXPENSE',
    count: missingEvidenceCount,
    message: 'Tax expenses have missing or unverified evidence',
  }));
  if (withholdingPendingCount > 0) exceptions.push(blocker({
    code: 'WITHHOLDING_NOT_COMPLETED',
    source: 'WITHHOLDING_TAX',
    count: withholdingPendingCount,
    message: 'Withholding-required expenses have not been marked as withheld',
  }));
  if (missingWithholdingCertificateCount > 0) exceptions.push(blocker({
    code: 'WITHHOLDING_CERTIFICATE_MISSING',
    source: 'WITHHOLDING_TAX',
    count: missingWithholdingCertificateCount,
    message: 'Withholding Tax evidence is missing a verified certificate',
  }));
  if (!['LOCKED', 'SUBMITTED'].includes(period?.status)) exceptions.push(blocker({
    code: 'TAX_PERIOD_NOT_LOCKED',
    source: 'TAX_PERIOD',
    message: 'Tax period must be locked or submitted before accountant handoff',
  }));

  return Object.freeze(exceptions);
};

module.exports = Object.freeze({ buildClosingExceptions });
