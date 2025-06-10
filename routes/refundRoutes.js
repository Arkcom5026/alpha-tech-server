const express = require('express');
const router = express.Router();
const { createRefundTransaction } = require('../controllers/refundController');

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

router.post('/create', createRefundTransaction);

module.exports = router;
