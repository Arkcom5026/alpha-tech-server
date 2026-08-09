'use strict';

const express = require('express');
const {
  receiveCustomerMoneyController,
  listCustomerMoneyReceiveController,
  getCustomerMoneyReceiveController,
  cancelCustomerMoneyReceiveController,
} = require('./receiveCustomerMoneyController');

const createReceiveCustomerMoneyRoute = ({ verifyToken, runtime }) => {
  const router = express.Router();

  if (verifyToken) router.use(verifyToken);
  router.use((req, _res, next) => {
    req.customerMoneyReceive = runtime;
    next();
  });

  router.get('/', listCustomerMoneyReceiveController);
  router.get('/:id', getCustomerMoneyReceiveController);
  router.post('/', receiveCustomerMoneyController);
  router.post('/:id/cancel', cancelCustomerMoneyReceiveController);

  return router;
};

module.exports = { createReceiveCustomerMoneyRoute };
