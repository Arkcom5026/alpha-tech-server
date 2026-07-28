'use strict';

const service = require('../service/supplierAdvanceService');
const branchId = (req) => Number(req.user?.branchId || req.user?.employeeBranchId || 0);
const employeeId = (req) => Number(req.user?.employeeProfileId || req.user?.employeeId || 0);
const handle = (operation, status = 200) => async (req, res, next) => {
  try {
    return res.status(status).json({ ok: true, data: await operation(req) });
  } catch (error) {
    return next(error);
  }
};
const context = (req) => ({ ...req.body, branchId: branchId(req), employeeId: employeeId(req) });

module.exports = Object.freeze({
  activateLegacy: handle((req) => service.activateLegacy({
    ...context(req), advanceId: req.params.advanceId,
  })),
  apply: handle((req) => service.apply({ ...context(req), advanceId: req.params.advanceId })),
  create: handle((req) => service.create(context(req)), 201),
  list: handle((req) => service.list({ ...req.query, branchId: branchId(req) })),
  voidAdvance: handle((req) => service.voidAdvance({
    ...context(req), advanceId: req.params.advanceId,
  })),
});
