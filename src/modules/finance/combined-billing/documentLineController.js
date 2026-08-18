'use strict';

const { prisma } = require('../../../../lib/prisma');
const { updateConsolidatedDocumentLine } = require('./documentLineService');

const update = async (req, res, next) => {
  try {
    const result = await updateConsolidatedDocumentLine({
      prisma,
      branchId: req.user?.branchId,
      documentId: req.params?.id,
      lineId: req.params?.lineId,
      employeeId: req.user?.employeeId,
      documentPrefix: req.body?.documentPrefix,
      documentDescription: req.body?.documentDescription,
      documentSuffix: req.body?.documentSuffix,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

module.exports = { update };
