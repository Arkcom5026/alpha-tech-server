'use strict';

const createCustomerMoneyLedger = ({ client, data }) => {
  if (!client?.customerMoneyLedger) {
    throw new TypeError('Customer Money ledger client is required');
  }
  return client.customerMoneyLedger.create({ data });
};

module.exports = { createCustomerMoneyLedger };
