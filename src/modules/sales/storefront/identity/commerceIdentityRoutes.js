'use strict';

const express = require('express');
const {
  requestController,
  verifyController,
} = require('./commerceIdentityController');

const router = express.Router({ mergeParams: true });

router.post('/request', requestController);
router.post('/verify', verifyController);

module.exports = router;
