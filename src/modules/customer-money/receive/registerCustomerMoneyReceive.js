'use strict';

const { prisma } = require('../../../../lib/prisma');
const verifyToken = require('../../../../middlewares/verifyToken');
const { createCustomerMoneyLedger } = require('../ledger/createCustomerMoneyLedgerService');
const { updateCustomerMoneyBalance } = require('../balance/updateCustomerMoneyBalanceService');
const {
  createCustomerMoneyReceipt,
  listCustomerMoneyReceipts,
  getCustomerMoneyReceipt,
} = require('./createCustomerMoneyReceiptRepository');
const {
  receiveCustomerMoney,
  listCustomerMoneyReceives,
  getCustomerMoneyReceive,
  cancelCustomerMoneyReceive,
} = require('./receiveCustomerMoneyService');
const { createReceiveCustomerMoneyRoute } = require('./receiveCustomerMoneyRoute');

const createRuntime = () => ({
  receive: (input, user) => receiveCustomerMoney({
    prisma,
    receiptRepository: createCustomerMoneyReceipt,
    createLedger: createCustomerMoneyLedger,
    updateBalance: updateCustomerMoneyBalance,
    input,
    user,
  }),
  list: (user, query) => listCustomerMoneyReceives({
    prisma,
    listRepository: listCustomerMoneyReceipts,
    user,
    query,
  }),
  getById: (id, user) => getCustomerMoneyReceive({
    prisma,
    getRepository: getCustomerMoneyReceipt,
    user,
    id,
  }),
  cancel: (id, cancelReason, user) => cancelCustomerMoneyReceive({
    prisma,
    getRepository: getCustomerMoneyReceipt,
    createLedger: createCustomerMoneyLedger,
    updateBalance: updateCustomerMoneyBalance,
    user,
    id,
    cancelReason,
  }),
});

const mountCustomerMoneyReceiveModule = (app) => {
  const runtime = createRuntime();
  const router = createReceiveCustomerMoneyRoute({ verifyToken, runtime });
  app.use('/api/customer-money-receive', router);
  return router;
};

module.exports = { createRuntime, mountCustomerMoneyReceiveModule };
