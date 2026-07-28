'use strict';

const service = require('../service/supplierPayableService');

const branchId = (req) => Number(req.user?.branchId || req.user?.employeeBranchId || 0);
const employeeId = (req) => Number(req.user?.employeeProfileId || req.user?.employeeId || 0);

const handle = (operation, successStatus = 200) => async (req, res, next) => {
  try {
    const result = await operation(req);
    return res.status(successStatus).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const listCandidates = handle((req) => service.listCandidates({
  ...req.query,
  branchId: branchId(req),
}));
const list = handle((req) => service.list({ ...req.query, branchId: branchId(req) }));
const createFromReceipts = handle((req) => service.createFromReceipts({
  ...req.body,
  branchId: branchId(req),
  createdById: employeeId(req),
}), 201);

module.exports = Object.freeze({ createFromReceipts, list, listCandidates });
