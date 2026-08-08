'use strict';

const updateCustomerMoneyBalance = ({ client, branchId, customerId, availableAmount }) => {
  if (!client?.customerMoneyBalance) {
    throw new TypeError('Customer Money balance client is required');
  }
  return client.customerMoneyBalance.upsert({
    where: { branchId_customerId: { branchId, customerId } },
    create: { branchId, customerId, availableAmount },
    update: { availableAmount },
  });
};

module.exports = { updateCustomerMoneyBalance };
