const express = require('express');
const router = express.Router();

const {
  receiveCustomerMoney,
  listCustomerMoneyReceives,
  getCustomerMoneyReceive,
} = require('../receiveCustomerMoneyController');

const verifyToken = require('../../../../../middlewares/verifyToken');
const { traceVerifyToken } = require('../../../../../middlewares/authTrace');

router.use(traceVerifyToken, verifyToken);
router.get('/', listCustomerMoneyReceives);
router.get('/:id', getCustomerMoneyReceive);
router.post('/', receiveCustomerMoney);

module.exports = router;
