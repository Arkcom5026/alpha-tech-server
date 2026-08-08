'use strict';

const express = require('express');
const { receiveCustomerMoneyController } = require('./receiveCustomerMoneyController');

const createReceiveCustomerMoneyRoute = ({ receiveCustomerMoneyService }) => {
  const router = express.Router();

  router.post('/receive', (req, res, next) => {
    req.receiveCustomerMoneyService = receiveCustomerMoneyService;
    return receiveCustomerMoneyController(req, res, next);
  });

  return router;
};

module.exports = { createReceiveCustomerMoneyRoute };
