const express = require('express');
const {
  getPublicRepairTracking,
} = require('../customer-access/repairTrackingAccessController');

const router = express.Router();

router.get('/tracking/:token', getPublicRepairTracking);

module.exports = router;
