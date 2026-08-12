'use strict';

const CUSTOMER_MONEY_LOCK_NAMESPACE = -1003;
const { resolveFinancialCustomerGroup } = require('../../customer/financial-group/customerFinancialGroupResolver');

const acquireCustomerMoneyTransactionLock = async (client, customerId, branchId) => {
  const normalizedCustomerId = Number(customerId);
  if (!Number.isInteger(normalizedCustomerId) || normalizedCustomerId <= 0) {
    throw new TypeError('A positive customerId is required for the Customer Money transaction lock');
  }
  if (!client?.$queryRaw) return normalizedCustomerId;
  let lockCustomerId = normalizedCustomerId;
  if (branchId != null && client?.customerProfile) {
    const group = await resolveFinancialCustomerGroup(client, { customerId: normalizedCustomerId, branchId });
    lockCustomerId = group.ownerId;
  }
  await client.$queryRaw`SELECT 1::int AS "locked" FROM (SELECT pg_advisory_xact_lock(${CUSTOMER_MONEY_LOCK_NAMESPACE}::int, ${lockCustomerId}::int)) AS advisory_lock`;
  return lockCustomerId;
};

module.exports = {
  CUSTOMER_MONEY_LOCK_NAMESPACE,
  acquireCustomerMoneyTransactionLock,
};
