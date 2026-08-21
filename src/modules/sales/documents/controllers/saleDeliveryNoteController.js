'use strict';

const { prisma } = require('../../../../../lib/prisma');
const { issueSaleDeliveryNote } = require('../issue/issueSaleDeliveryNoteService');
const { projectCurrentSaleDeliveryNote } = require('../print/projectCurrentSaleDeliveryNoteService');
const { projectHistoricalSaleDeliveryNoteRevision } = require('../print/projectHistoricalSaleDeliveryNoteRevisionService');
const {
  listDeliveryNoteRevisionHistory,
  getDeliveryNoteRevisionById,
} = require('../../delivery-note/lifecycle/deliveryNoteRevisionHistoryService');
const {
  createReturnAdjustedDeliveryNoteRevision,
} = require('../../delivery-note/lifecycle/deliveryNoteRevisionService');

const authenticatedBranchId = (req) => {
  const branchId = Number(req.user?.branchId);
  return Number.isInteger(branchId) && branchId > 0 ? branchId : null;
};

const authenticatedEmployeeId = (req) => {
  const employeeId = Number(req.user?.employeeId);
  return Number.isInteger(employeeId) && employeeId > 0 ? employeeId : null;
};

const getSaleDeliveryNote = async (req, res, next) => {
  try {
    const branchId = authenticatedBranchId(req);
    if (!branchId) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authenticated branch is required' });
    }

    const result = await projectCurrentSaleDeliveryNote({
      branchId,
      saleId: req.params.id,
    });

    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const getSaleDeliveryNoteRevisions = async (req, res, next) => {
  try {
    const branchId = authenticatedBranchId(req);
    if (!branchId) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authenticated branch is required' });
    }
    const result = await listDeliveryNoteRevisionHistory({
      prisma,
      branchId,
      saleId: req.params.id,
    });
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const createSaleDeliveryNoteRevision = async (req, res, next) => {
  try {
    const branchId = authenticatedBranchId(req);
    const employeeId = authenticatedEmployeeId(req);
    if (!branchId || !employeeId) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authenticated branch and employee are required',
      });
    }

    const result = await createReturnAdjustedDeliveryNoteRevision({
      prisma,
      branchId,
      saleId: req.params.id,
      employeeId,
      // Numbering is server-owned. Client input must never choose an immutable
      // Delivery Note revision number.
    });

    return res.status(201).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const getSaleDeliveryNoteRevision = async (req, res, next) => {
  try {
    const branchId = authenticatedBranchId(req);
    if (!branchId) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authenticated branch is required' });
    }
    const result = await getDeliveryNoteRevisionById({
      prisma,
      branchId,
      saleId: req.params.id,
      revisionId: req.params.revisionId,
    });
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const getSaleDeliveryNoteRevisionPrint = async (req, res, next) => {
  try {
    const branchId = authenticatedBranchId(req);
    if (!branchId) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authenticated branch is required' });
    }
    const result = await projectHistoricalSaleDeliveryNoteRevision({
      branchId,
      saleId: req.params.id,
      revisionId: req.params.revisionId,
    });
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const issueSaleDeliveryNoteController = async (req, res, next) => {
  try {
    const branchId = authenticatedBranchId(req);
    if (!branchId) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authenticated branch is required' });
    }

    const result = await issueSaleDeliveryNote({
      branchId,
      saleId: req.params.id,
    });

    return res.status(result.replayed ? 200 : 201).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({
  getSaleDeliveryNote,
  getSaleDeliveryNoteRevisions,
  createSaleDeliveryNoteRevision,
  getSaleDeliveryNoteRevision,
  getSaleDeliveryNoteRevisionPrint,
  issueSaleDeliveryNoteController,
});
