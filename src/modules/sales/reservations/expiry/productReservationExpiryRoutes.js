'use strict';

const express = require('express');
const verifyToken = require('../../../../../middlewares/verifyToken');
const { createExpiryRunner } = require('./productReservationExpiryRunner');

const router = express.Router();
const runner = createExpiryRunner();

router.use(verifyToken);

router.post('/run', async (req, res, next) => {
  try {
    if (!req.user?.isSuperAdmin && !req.user?.branchId) {
      return res.status(403).json({ code: 'EXPIRY_BRANCH_CONTEXT_REQUIRED', message: 'Branch context is required' });
    }
    const data = await runner.run({
      branchId: req.user.isSuperAdmin ? (req.body?.branchId ?? null) : req.user.branchId,
      limit: req.body?.limit,
    });
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
