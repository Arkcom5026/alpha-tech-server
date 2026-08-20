'use strict';

const { prisma } = require('../../../../lib/prisma');
const {
  createSaleDocumentPreparation,
  getSaleDocumentPreparation,
  lockSaleDocumentPreparation,
  replaceSaleDocumentPreparationLines,
} = require('./documentPreparationService');
const {
  registerDocumentPreparationTaxCandidates,
} = require('../../tax/sources/document-preparation/registerDocumentPreparationTaxCandidatesService');

const respondError = (res, error) => {
  const status = Number(error?.statusCode) || 500;
  if (status >= 500) console.error('[sale-document-preparation] error', error);
  return res.status(status).json({
    error: error?.message || 'Document preparation operation failed',
    code: error?.code || 'DOCUMENT_PREPARATION_INTERNAL_ERROR',
  });
};

const getSaleDocumentPreparationController = async (req, res) => {
  try {
    const preparation = await getSaleDocumentPreparation({
      prisma,
      branchId: req.user?.branchId,
      saleId: req.params.id,
    });
    return res.json({ preparation });
  } catch (error) {
    return respondError(res, error);
  }
};

const createSaleDocumentPreparationController = async (req, res) => {
  try {
    const result = await createSaleDocumentPreparation({
      prisma,
      branchId: req.user?.branchId,
      saleId: req.params.id,
      actorEmployeeId: req.user?.employeeId,
    });
    return res.status(result.replayed ? 200 : 201).json(result);
  } catch (error) {
    return respondError(res, error);
  }
};

const replaceSaleDocumentPreparationLinesController = async (req, res) => {
  try {
    const preparation = await replaceSaleDocumentPreparationLines({
      prisma,
      branchId: req.user?.branchId,
      saleId: req.params.id,
      actorEmployeeId: req.user?.employeeId,
      lines: req.body?.lines,
    });
    return res.json({ preparation });
  } catch (error) {
    return respondError(res, error);
  }
};

const lockSaleDocumentPreparationController = async (req, res) => {
  try {
    const result = await lockSaleDocumentPreparation({
      prisma,
      branchId: req.user?.branchId,
      saleId: req.params.id,
      actorEmployeeId: req.user?.employeeId,
    });
    return res.json(result);
  } catch (error) {
    return respondError(res, error);
  }
};

const registerSaleDocumentPreparationTaxCandidatesController = async (req, res) => {
  try {
    const result = await registerDocumentPreparationTaxCandidates({
      branchId: req.user?.branchId,
      saleId: req.params.id,
      actorEmployeeId: req.user?.employeeId,
    });
    return res.json(result);
  } catch (error) {
    return respondError(res, error);
  }
};

module.exports = Object.freeze({
  createSaleDocumentPreparationController,
  getSaleDocumentPreparationController,
  lockSaleDocumentPreparationController,
  registerSaleDocumentPreparationTaxCandidatesController,
  replaceSaleDocumentPreparationLinesController,
});
