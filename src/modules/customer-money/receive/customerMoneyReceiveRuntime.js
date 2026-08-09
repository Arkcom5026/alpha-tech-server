'use strict';

const { createRuntime } = require('./registerCustomerMoneyReceive');

const createCustomerMoneyReceiveRuntime = () => createRuntime();

module.exports = { createCustomerMoneyReceiveRuntime };
