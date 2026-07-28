'use strict';

const { cancelProductReservation } = require('./productReservationCancelService');

const resolvePositiveInt = (...values) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const cancelProductReservationController = async (req, res, next) => {
  try {
    const result = await cancelProductReservation(
      { id: req.params.id, reason: req.body?.reason },
      {
        branchId: resolvePositiveInt(
          req.body?.branchId,
          req.user?.branchId,
          req.user?.employeeBranchId,
          req.user?.currentBranchId
        ),
        employeeId: resolvePositiveInt(
          req.user?.employeeProfileId,
          req.user?.employeeId,
          req.employee?.id
        ),
      }
    );
    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({ cancelProductReservationController });
