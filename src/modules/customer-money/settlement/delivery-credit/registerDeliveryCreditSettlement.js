'use strict';

const { prisma } = require('../../../../../lib/prisma');
const verifyToken = require('../../../../../middlewares/verifyToken');
const { parseEligibleSalesQuery, parseCreateSettlementInput } = require('./deliveryCreditSettlementContract');
const { listEligibleDeliveryCredits } = require('./listEligibleDeliveryCreditsService');
const { createDeliveryCreditSettlement } = require('./createDeliveryCreditSettlementService');
const { cancelDeliveryCreditSettlement } = require('./cancelDeliveryCreditSettlementService');
const { listDeliveryCreditSettlements, getDeliveryCreditSettlement } = require('./queryDeliveryCreditSettlementService');
const { createDeliveryCreditSettlementRoute } = require('./deliveryCreditSettlementRoute');

const createRuntime = () => ({
  listEligible: (query, user) => listEligibleDeliveryCredits({
    prisma,
    command: parseEligibleSalesQuery(query, user),
  }),
  create: (input, user) => createDeliveryCreditSettlement({
    prisma,
    command: parseCreateSettlementInput(input, user),
  }),
  list: (query, user) => listDeliveryCreditSettlements({ prisma, user, query }),
  getById: (id, user) => getDeliveryCreditSettlement({ prisma, user, id }),
  cancel: (id, cancelReason, user) => cancelDeliveryCreditSettlement({
    prisma,
    user,
    id,
    cancelReason,
  }),
});

const mountDeliveryCreditSettlementModule = (app) => {
  const runtime = createRuntime();
  const router = createDeliveryCreditSettlementRoute({ verifyToken, runtime });
  app.use('/api/customer-money-settlements/delivery-credit', router);
  return router;
};

module.exports = { createRuntime, mountDeliveryCreditSettlementModule };