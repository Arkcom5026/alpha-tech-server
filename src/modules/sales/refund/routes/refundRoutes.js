const express = require('express');
const verifyToken = require('../../../../../middlewares/verifyToken');
const {
  createRefundTransaction,
} = require('../create/createRefundTransactionController');

const router = express.Router();
router.use(verifyToken);
router.post('/create', createRefundTransaction);

module.exports = router;
