// routes/uploadSlipRoutes.js
const express = require('express');
const router = express.Router();

const uploadSlipMiddleware = require('../middlewares/uploadSlipMiddleware');
const { uploadAndSaveSlip } = require('../controllers/upload/uploadSlipController');

router.post('/:id/slip/upload', uploadSlipMiddleware.single('slip'), uploadAndSaveSlip);

module.exports = router;
