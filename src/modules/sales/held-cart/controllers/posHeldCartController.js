'use strict';

const service = require('../services/posHeldCartService');
const context = (req) => ({
  branchId: Number(req.user?.branchId || req.user?.employeeBranchId || 0),
  employeeId: Number(req.user?.employeeId || req.user?.employeeProfileId || 0),
});
const handle = (operation, status = 200) => async (req, res, next) => {
  try { return res.status(status).json({ ok: true, data: await operation(req) }); } catch (error) { return next(error); }
};
module.exports = Object.freeze({
  list: handle((req) => service.list({ ...req.query, ...context(req) })),
  detail: handle((req) => service.detail({ heldCartId: req.params.heldCartId, ...context(req) })),
  create: handle((req) => service.create({ ...req.body, ...context(req) }), 201),
  update: handle((req) => service.update({ ...req.body, heldCartId: req.params.heldCartId, ...context(req) })),
  revalidate: handle((req) => service.revalidate({ heldCartId: req.params.heldCartId, ...context(req) })),
  cancel: handle((req) => service.cancel({ ...req.body, heldCartId: req.params.heldCartId, ...context(req) })),
});
