// src/modules/commerce/payment-slip/routes/uploadSlipRoutes.js

const express = require('express');
const router = express.Router();

const uploadSlipMiddleware = require('../../../../../middlewares/uploadSlipMiddleware');
const { uploadAndSaveSlip } = require('../runtime/uploadSlipRuntimeController');

router.post('/:id/slip/upload', uploadSlipMiddleware.single('slip'), uploadAndSaveSlip);

module.exports = router;
