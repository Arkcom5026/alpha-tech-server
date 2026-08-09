'use strict';

const { prisma } = require('../../../../../lib/prisma');
const verifyToken = require('../../../../../middlewares/verifyToken');
const { parseEligibleSalesQuery } = require('./deliveryCreditSettlementContract');
const { listEligibleDeliveryCredits } = require('./listEligibleDeliveryCreditsService');
const { createDeliveryCreditSettlementRoute } = require('./deliveryCreditSettlementRoute');

const createRuntime = () => ({
  listEligible: (query, user) => listEligibleDeliveryCredits({
    prisma,
    command: parseEligibleSalesQuery(query, user),
  }),
});

const mountDeliveryCreditSettlementModule = (app) => {
  const runtime = createRuntime();
  const router = createDeliveryCreditSettlementRoute({ verifyToken, runtime });
  app.use('/api/customer-money-settlements/delivery-credit', router);
  return router;
};

module.exports = { createRuntime, mountDeliveryCreditSettlementModule };
