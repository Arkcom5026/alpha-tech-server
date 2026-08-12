'use strict';

const CUSTOMER_MONEY_LOCK_NAMESPACE = -1003;

const acquireCustomerMoneyTransactionLock = async (client, customerId) => {
  const normalizedCustomerId = Number(customerId);
  if (!Number.isInteger(normalizedCustomerId) || normalizedCustomerId <= 0) {
    throw new TypeError('A positive customerId is required for the Customer Money transaction lock');
  }
  if (!client?.$queryRaw) return;
  await client.$queryRaw`SELECT pg_advisory_xact_lock(${CUSTOMER_MONEY_LOCK_NAMESPACE}, ${normalizedCustomerId})`;
};

module.exports = {
  CUSTOMER_MONEY_LOCK_NAMESPACE,
  acquireCustomerMoneyTransactionLock,
};