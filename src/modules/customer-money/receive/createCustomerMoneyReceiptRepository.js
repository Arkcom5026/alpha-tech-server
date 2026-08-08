'use strict';

/**
 * Customer Money Receive persistence boundary.
 *
 * Receipt storage is intentionally isolated from application/payment flows.
 * The repository accepts a transaction client so receipt, ledger and balance
 * updates can share one Prisma transaction boundary.
 */

const createCustomerMoneyReceipt = ({ client, data }) => {
  if (!client?.customerMoneyReceipt) {
    throw new TypeError('Customer Money receipt client is required');
  }

  return client.customerMoneyReceipt.create({ data });
};

module.exports = { createCustomerMoneyReceipt };
