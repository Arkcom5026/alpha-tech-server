'use strict';

const { createProductReservation } = require('./productReservationCreateService');

const resolvePositiveInt = (...values) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
};

const createProductReservationController = async (req, res, next) => {
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

    const result = await createProductReservation(req.body, {
      branchId,
      employeeId,
      commandId: req.body?.commandId || req.headers['x-command-id'],
    });

    return res.status(201).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({ createProductReservationController });