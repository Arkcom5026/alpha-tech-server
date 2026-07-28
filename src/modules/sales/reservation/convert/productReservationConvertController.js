'use strict';

const { convertProductReservationToSale } = require('./productReservationConvertService');

const resolvePositiveInt = (...values) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const convertProductReservationToSaleController = async (req, res, next) => {
  try {
    const reservationId = resolvePositiveInt(req.params?.id);
    const branchId = resolvePositiveInt(
      req.user?.branchId,
      req.user?.employeeBranchId,
      req.user?.currentBranchId,
      req.body?.branchId
    );
    const employeeId = resolvePositiveInt(
      req.user?.employeeProfileId,
      req.user?.employeeId,
      req.employee?.id
    );
    const result = await convertProductReservationToSale(req.body, {
      reservationId,
      branchId,
      employeeId,
      commandId: req.body?.commandId || req.headers['x-command-id'],
    });
    return res.status(result.idempotency?.replayed ? 200 : 201).json({ ok: true, data: result });
  } catch (error) {
    // Canonical Sales Completion uses `status`; reservation middleware uses `statusCode`.
    if (!error.statusCode && Number.isInteger(Number(error.status))) {
      error.statusCode = Number(error.status);
    }
    return next(error);
  }
};

module.exports = Object.freeze({ convertProductReservationToSaleController });
