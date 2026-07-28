'use strict';

const { transitionProductReservationDeliveryStatus } = require('./productReservationDeliveryStatusService');

const resolvePositiveInt = (...values) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const makeController = (targetStatus) => async (req, res, next) => {
  try {
    const result = await transitionProductReservationDeliveryStatus({
      reservationId: resolvePositiveInt(req.params?.id),
      branchId: resolvePositiveInt(
        req.user?.branchId,
        req.user?.employeeBranchId,
        req.user?.currentBranchId,
        req.body?.branchId
      ),
      targetStatus,
    });
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({
  markProductReservationReadyToShipController: makeController('READY_TO_SHIP'),
  markProductReservationShippingController: makeController('SHIPPING'),
  markProductReservationDeliveredController: makeController('DELIVERED'),
});
