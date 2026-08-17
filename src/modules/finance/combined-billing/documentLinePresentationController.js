'use strict';

const { prisma } = require('../../../../lib/prisma');
const { updateConsolidatedDocumentLines } = require('./documentLinePresentationService');

const update = async (req, res, next) => {
  try {
    const result = await updateConsolidatedDocumentLines({
      prisma,
      branchId: req.user?.branchId,
      combinedBillingId: req.params?.id,
      employeeId: req.user?.employeeId,
      lines: req.body?.lines,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

module.exports = { update };
