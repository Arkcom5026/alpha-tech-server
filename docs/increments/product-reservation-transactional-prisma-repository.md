'use strict';

const verifyToken = require('../../../../../middlewares/verifyToken');
const express = require('express');
const {
  listMerchantReservations,
  getMerchantReservationDetail,
} = require('./productReservationMerchantQueryRepository');
const { createProductReservationLifecycleService } = require('../lifecycle/productReservationLifecycleService');
const lifecycleRepository = require('../lifecycle/productReservationLifecyclePrismaRepository');

const router = express.Router();
const lifecycleService = createProductReservationLifecycleService({ repository: lifecycleRepository });

const ensureMerchantContext = (req, res, next) => {
  if (!req.user?.employeeId || !req.user?.branchId) {
    return res.status(403).json({
      code: 'MERCHANT_EMPLOYEE_CONTEXT_REQUIRED',
      message: 'Employee branch context is required',
    });
  }
  return next();
};

const allowedStatuses = new Set([
  'ACTIVE',
  'ACCEPTED',
  'FULFILLMENT_READY',
  'READY_FOR_PICKUP',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
]);

const parseStatuses = (value) => {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((status) => status.trim().toUpperCase())
    .filter((status) => allowedStatuses.has(status));
};

router.use(verifyToken, ensureMerchantContext);

router.get('/', async (req, res, next) => {
  try {
    const data = await listMerchantReservations({
      branchId: req.user.branchId,
      statuses: parseStatuses(req.query.status),
      limit: req.query.limit,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
});

router.get('/:reservationId', async (req, res, next) => {
  try {
    const reservationId = Number(req.params.reservationId);
    if (!Number.isInteger(reservationId) || reservationId <= 0) {
      return res.status(400).json({ code: 'PRODUCT_RESERVATION_ID_INVALID', message: 'Invalid reservation id' });
    }
    const data = await getMerchantReservationDetail({ reservationId, branchId: req.user.branchId });
    if (!data) {
      return res.status(404).json({ code: 'PRODUCT_RESERVATION_NOT_FOUND', message: 'Reservation not found' });
    }
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
});

router.post('/:reservationId/lifecycle', async (req, res, next) => {
  try {
    const result = await lifecycleService.execute({
      reservationId: Number(req.params.reservationId),
      branchId: req.user.branchId,
      actorId: req.user.employeeId,
      commandKey: req.get('X-Idempotency-Key'),
      commandType: req.body?.commandType,
      reason: req.body?.reason,
      occurredAt: req.body?.occurredAt,
    });
    return res.status(result.replayed ? 200 : 201).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
