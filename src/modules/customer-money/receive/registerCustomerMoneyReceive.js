'use strict';

const { createCustomerMoneyReceiveRuntime } = require('./customerMoneyReceiveRuntime');

const mountCustomerMoneyReceiveModule = (app) => {
  const runtime = createCustomerMoneyReceiveRuntime();

  app.use('/api/customer-money', runtime.routes);

  return runtime;
};

module.exports = { mountCustomerMoneyReceiveModule };
