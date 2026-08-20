'use strict';

const { prisma } = require('../../../../lib/prisma');
const {
  createSaleDocumentReplacement,
  getSaleDocumentReplacement,
  lockSaleDocumentReplacement,
  replaceSaleDocumentReplacementLines,
} = require('./documentReplacementService');

const respondError = (res, error) => {
  const status = Number(error?.statusCode) || 500;
  if (status >= 500) console.error('[sale-document-replacement] error', error);
  return res.status(status).json({
    error: error?.message || 'Document replacement operation failed',
    code: error?.code || 'DOCUMENT_REPLACEMENT_INTERNAL_ERROR',
  });
};

const getSaleDocumentReplacementController = async (req, res) => {
  try {
    const replacement = await getSaleDocumentReplacement({
      prisma,
      branchId: req.user?.branchId,
      saleId: req.params.id,
    });
    return res.json({ replacement });
  } catch (error) {
    return respondError(res, error);
  }
};

const createSaleDocumentReplacementController = async (req, res) => {
  try {
    const result = await createSaleDocumentReplacement({
      prisma,
      branchId: req.user?.branchId,
      saleId: req.params.id,
      actorEmployeeId: req.user?.employeeId,
      reason: req.body?.reason,
    });
    return res.status(result.replayed ? 200 : 201).json(result);
  } catch (error) {
    return respondError(res, error);
  }
};

const replaceSaleDocumentReplacementLinesController = async (req, res) => {
  try {
    const replacement = await replaceSaleDocumentReplacementLines({
      prisma,
      branchId: req.user?.branchId,
      saleId: req.params.id,
      actorEmployeeId: req.user?.employeeId,
      inBudgetLines: req.body?.inBudgetLines,
      outOfBudgetLines: req.body?.outOfBudgetLines,
    });
    return res.json({ replacement });
  } catch (error) {
    return respondError(res, error);
  }
};

const lockSaleDocumentReplacementController = async (req, res) => {
  try {
    const result = await lockSaleDocumentReplacement({
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

module.exports = Object.freeze({
  createSaleDocumentReplacementController,
  getSaleDocumentReplacementController,
  lockSaleDocumentReplacementController,
  replaceSaleDocumentReplacementLinesController,
});
