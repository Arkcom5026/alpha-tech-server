'use strict';

const { createReceiveCustomerMoneyRoute } = require('./receiveCustomerMoneyRoute');
const { receiveCustomerMoneyService } = require('./receiveCustomerMoneyService');

const createCustomerMoneyReceiveRuntime = () => {
  return {
    routes: createReceiveCustomerMoneyRoute({
      receiveCustomerMoneyService,
    }),
  };
};

module.exports = { createCustomerMoneyReceiveRuntime };
