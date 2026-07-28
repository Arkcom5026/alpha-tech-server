'use strict';

const { expireDueProductReservations } = require('./productReservationExpiryService');

const resolvePositiveInt = (...values) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const expireDueProductReservationsController = async (req, res, next) => {
  try {
    const branchId = resolvePositiveInt(
      req.body?.branchId,
      req.user?.branchId,
      req.user?.employeeBranchId,
      req.user?.currentBranchId
    );
    const employeeId = resolvePositiveInt(
      req.user?.employeeProfileId,
      req.user?.employeeId,
      req.employee?.id
    );

    const result = await expireDueProductReservations(req.body, { branchId, employeeId });
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({ expireDueProductReservationsController });
