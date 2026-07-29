'use strict';

const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const { createOperationalVerificationService } = require('./operationalVerificationService');

const router = express.Router();
const service = createOperationalVerificationService();

const requireAdministrator = (req, res, next) => {
  const role = String(req.user?.role || '').toUpperCase();
  if (!['ADMIN', 'SUPERADMIN'].includes(role)) {
    return res.status(403).json({
      ok: false,
      code: 'OPERATIONAL_VERIFICATION_ADMIN_REQUIRED',
      message: 'Administrator authority is required',
    });
  }
  return next();
};

router.use(verifyToken, requireAdministrator);

router.get('/', async (_req, res, next) => {
  try {
    const data = await service.run();
    return res.status(data.status === 'FAILED' ? 503 : 200).json({ ok: data.status !== 'FAILED', data });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
