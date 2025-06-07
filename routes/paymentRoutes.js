const express = require('express');
const router = express.Router();
const { createPayment } = require('../controllers/paymentController');
const { verifyToken } = require('../middlewares/verifyToken');

router.post('/payments', verifyToken, createPayment);

module.exports = router;
