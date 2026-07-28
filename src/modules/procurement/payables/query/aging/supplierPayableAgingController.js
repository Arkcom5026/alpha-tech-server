'use strict';

const service = require('./supplierPayableAgingService');

const list = async (req, res, next) => {
  try {
    const data = await service.list({
      ...req.query,
      branchId: Number(req.user?.branchId || req.user?.employeeBranchId || 0),
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({ list });
