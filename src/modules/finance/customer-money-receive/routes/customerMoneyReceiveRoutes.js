const express = require('express');
const router = express.Router();

const { receiveCustomerMoney } = require('../receiveCustomerMoneyController');

const verifyToken = require('../../../../../middlewares/verifyToken');
const { traceVerifyToken } = require('../../../../../middlewares/authTrace');

router.use(traceVerifyToken, verifyToken);

router.post('/', receiveCustomerMoney);

module.exports = router;
