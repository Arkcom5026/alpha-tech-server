'use strict';

const {
  receiveCustomerMoney,
  listCustomerMoneyReceives,
  getCustomerMoneyReceive,
} = require('./receiveCustomerMoneyService');
const { createReceiveCustomerMoneyRoute } = require('./receiveCustomerMoneyRoute');
const { createRuntime, mountCustomerMoneyReceiveModule } = require('./registerCustomerMoneyReceive');

module.exports = {
  receiveCustomerMoney,
  listCustomerMoneyReceives,
  getCustomerMoneyReceive,
  createReceiveCustomerMoneyRoute,
  createRuntime,
  mountCustomerMoneyReceiveModule,
};
