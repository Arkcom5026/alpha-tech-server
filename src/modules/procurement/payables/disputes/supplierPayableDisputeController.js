'use strict';

const service = require('./supplierPayableDisputeService');
const branchId = (req) => Number(req.user?.branchId || req.user?.employeeBranchId || 0);
const employeeId = (req) => Number(req.user?.employeeProfileId || req.user?.employeeId || 0);
const handle = (operation, status = 200) => async (req, res, next) => {
  try { return res.status(status).json({ ok: true, data: await operation(req) }); } catch (error) { return next(error); }
};

module.exports = Object.freeze({
  list: handle((req) => service.list({ ...req.query, branchId: branchId(req) })),
  open: handle((req) => service.open({ ...req.body, payableId: req.params.payableId, branchId: branchId(req), employeeId: employeeId(req) }), 201),
  createAdjustment: handle((req) => service.createAdjustment({ ...req.body, payableId: req.params.payableId, branchId: branchId(req), employeeId: employeeId(req) }), 201),
  resolve: handle((req) => service.resolve({ ...req.body, disputeId: req.params.disputeId, branchId: branchId(req), employeeId: employeeId(req) })),
  voidAdjustment: handle((req) => service.voidAdjustment({ ...req.body, adjustmentId: req.params.adjustmentId, branchId: branchId(req), employeeId: employeeId(req) })),
});
