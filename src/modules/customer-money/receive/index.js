'use strict';

const { receiveCustomerMoneyController } = require('./receiveCustomerMoneyController');
const { receiveCustomerMoneyService } = require('./receiveCustomerMoneyService');
const { createReceiveCustomerMoneyRoute } = require('./receiveCustomerMoneyRoute');

module.exports = {
  receiveCustomerMoneyController,
  receiveCustomerMoneyService,
  createReceiveCustomerMoneyRoute,
};
