'use strict';

const service = require('../service/supplierPaymentAllocationService');
const branchId = (req) => Number(req.user?.branchId || req.user?.employeeBranchId || 0);
const employeeId = (req) => Number(req.user?.employeeProfileId || req.user?.employeeId || 0);
const handle = (operation, status = 200) => async (req, res, next) => {
  try {
    return res.status(status).json({ ok: true, data: await operation(req) });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({
  createConfirmed: handle((req) => service.createConfirmed({
    ...req.body, branchId: branchId(req), employeeId: employeeId(req),
  }), 201),
  list: handle((req) => service.list({ ...req.query, branchId: branchId(req) })),
  voidConfirmed: handle((req) => service.voidConfirmed({
    ...req.body,
    branchId: branchId(req),
    employeeId: employeeId(req),
    paymentId: req.params.paymentId,
  })),
});
