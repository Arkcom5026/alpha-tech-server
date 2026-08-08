'use strict';

const createCustomerMoneyApplication = ({ client, data }) => {
  if (!client?.customerMoneyApplication) {
    throw new TypeError('Customer Money application client is required');
  }
  return client.customerMoneyApplication.create({ data });
};

module.exports = { createCustomerMoneyApplication };
