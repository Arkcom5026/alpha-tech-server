'use strict';

const { listProductReservations, getProductReservationById } = require('./productReservationQueryService');

const resolvePositiveInt = (...values) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const resolveBranchId = (req) => resolvePositiveInt(
  req.query?.branchId,
  req.body?.branchId,
  req.user?.branchId,
  req.user?.employeeBranchId,
  req.user?.currentBranchId
);

const listProductReservationsController = async (req, res, next) => {
  try {
    const result = await listProductReservations({ ...req.query, branchId: resolveBranchId(req) });
    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const getProductReservationByIdController = async (req, res, next) => {
  try {
    const result = await getProductReservationById({ id: req.params.id, branchId: resolveBranchId(req) });
    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({
  listProductReservationsController,
  getProductReservationByIdController,
});
