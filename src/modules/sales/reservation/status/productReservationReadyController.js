'use strict';

const { markProductReservationReady } = require('./productReservationReadyService');

const resolvePositiveInt = (...values) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const markProductReservationReadyController = async (req, res, next) => {
  try {
    const result = await markProductReservationReady({
      reservationId: resolvePositiveInt(req.params?.id),
      branchId: resolvePositiveInt(
        req.user?.branchId,
        req.user?.employeeBranchId,
        req.user?.currentBranchId,
        req.body?.branchId
      ),
    });
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({ markProductReservationReadyController });
