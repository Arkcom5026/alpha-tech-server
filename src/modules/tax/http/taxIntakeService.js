'use strict';

const candidateRepository = require('../candidates/repository/taxCandidateRepository');
const documentRepository = require('../documents/repository/taxDocumentRepository');
const { transitionTaxDocument } = require('../documents/lifecycle/transitionTaxDocumentService');
const { registerTaxCandidate } = require('../intake/registerTaxCandidateService');
const { registerSaleTaxCandidate } = require('../sources/sale/registerSaleTaxCandidateService');

const requirePositiveInt = (value, code, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${fieldName} must be a positive integer`), { code, statusCode: 400 });
  }
  return parsed;
};

const listCandidates = (input) => candidateRepository.list({
  branchId: requirePositiveInt(input.branchId, 'TAX_BRANCH_REQUIRED', 'branchId'),
  status: input.status ? String(input.status).trim().toUpperCase() : null,
  sourceType: input.sourceType ? String(input.sourceType).trim().toUpperCase() : null,
  limit: input.limit,
  offset: input.offset,
});

const listDocuments = (input) => documentRepository.list({
  branchId: requirePositiveInt(input.branchId, 'TAX_BRANCH_REQUIRED', 'branchId'),
  status: input.status ? String(input.status).trim().toUpperCase() : null,
  documentType: input.documentType ? String(input.documentType).trim().toUpperCase() : null,
  limit: input.limit,
  offset: input.offset,
});

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
  return document;
};

module.exports = Object.freeze({
  getDocumentDetail,
  listCandidates,
  listDocuments,
  registerSaleTaxCandidate,
  registerTaxCandidate,
  transitionTaxDocument,
});
