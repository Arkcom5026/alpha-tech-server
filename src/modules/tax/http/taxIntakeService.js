'use strict';

const candidateRepository = require('../candidates/repository/taxCandidateRepository');
const documentRepository = require('../documents/repository/taxDocumentRepository');
const taxPeriodRepository = require('../periods/taxPeriodRepository');
const periodProjectionRepository = require('./taxIntakePeriodProjectionRepository');
const { projectOutputTaxPrintableDocument } = require('../documents/print/projectOutputTaxPrintableDocumentService');
const { issueOutputTaxDocument } = require('../documents/issue/issueOutputTaxDocumentService');
const {
  issueOutputTaxCreditNote,
  issueOutputTaxCreditNoteForSaleReturn,
} = require('../documents/creditNote/create/issueOutputTaxCreditNoteService');
const { transitionTaxDocument } = require('../documents/lifecycle/transitionTaxDocumentService');
const { registerTaxCandidate } = require('../intake/registerTaxCandidateService');
const { registerSaleTaxCandidate } = require('../sources/sale/registerSaleTaxCandidateService');
const {
  projectInputTaxReconciliation,
} = require('../inputDocuments/reconciliation/inputTaxDocumentReconciliationService');

const requirePositiveInt = (value, code, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive integer`), { code, statusCode: 400 });
  }
  return parsed;
};

const resolveTaxPeriodScope = async ({ branchId, taxPeriodId }) => {
  const normalizedTaxPeriodId = String(taxPeriodId || '').trim();
  if (!normalizedTaxPeriodId) return null;

  const period = await taxPeriodRepository.findById({
    branchId,
    taxPeriodId: normalizedTaxPeriodId,
  });
  if (!period) {
    throw Object.assign(new Error('Tax period not found'), {
      code: 'TAX_PERIOD_NOT_FOUND',
      statusCode: 404,
    });
  }

  return Object.freeze({
    taxPeriodId: period.id,
    periodCode: period.periodCode,
    startDate: period.startDate,
    endDate: period.endDate,
  });
};

const listCandidates = async (input) => {
  const branchId = requirePositiveInt(input.branchId, 'TAX_BRANCH_REQUIRED', 'branchId');
  const period = await resolveTaxPeriodScope({ branchId, taxPeriodId: input.taxPeriodId });
  const args = {
    branchId,
    status: input.status ? String(input.status).trim().toUpperCase() : null,
    sourceType: input.sourceType ? String(input.sourceType).trim().toUpperCase() : null,
    limit: input.limit,
    offset: input.offset,
  };
  if (!period) return candidateRepository.list(args);
  return periodProjectionRepository.listCandidatesForPeriod({
    ...args,
    startDate: period.startDate,
    endDate: period.endDate,
  });
};

const listDocuments = async (input) => {
  const branchId = requirePositiveInt(input.branchId, 'TAX_BRANCH_REQUIRED', 'branchId');
  const period = await resolveTaxPeriodScope({ branchId, taxPeriodId: input.taxPeriodId });
  const args = {
    branchId,
    status: input.status ? String(input.status).trim().toUpperCase() : null,
    documentType: input.documentType ? String(input.documentType).trim().toUpperCase() : null,
    limit: input.limit,
    offset: input.offset,
  };
  if (!period) return documentRepository.list(args);
  return periodProjectionRepository.listDocumentsForPeriod({
    ...args,
    startDate: period.startDate,
    endDate: period.endDate,
  });
};

const getDocumentDetail = async (input) => {
  const branchId = requirePositiveInt(input.branchId, 'TAX_BRANCH_REQUIRED', 'branchId');
  const taxDocumentId = requirePositiveInt(input.taxDocumentId, 'TAX_DOCUMENT_ID_REQUIRED', 'taxDocumentId');
  const document = await documentRepository.findDetailById({ branchId, taxDocumentId });
  if (!document) {
    throw Object.assign(new Error('Tax document not found'), {
      code: 'TAX_DOCUMENT_NOT_FOUND',
      statusCode: 404,
    });
  }
  return {
    ...document,
    inputTaxReconciliation: await projectInputTaxReconciliation({ document }),
  };
};

module.exports = Object.freeze({
  getDocumentDetail,
  issueOutputTaxDocument,
  issueOutputTaxCreditNote,
  issueOutputTaxCreditNoteForSaleReturn,
  listCandidates,
  projectOutputTaxPrintableDocument,
  listDocuments,
  registerSaleTaxCandidate,
  registerTaxCandidate,
  resolveTaxPeriodScope,
  transitionTaxDocument,
});
