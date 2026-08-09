'use strict';

const express = require('express');
const { listEligibleDeliveryCreditsController } = require('./deliveryCreditSettlementController');

const createDeliveryCreditSettlementRoute = ({ verifyToken, runtime }) => {
  const router = express.Router();
  router.use(verifyToken);
  router.use((req, _res, next) => {
    req.customerMoneyDeliverySettlement = runtime;
    next();
  });
  router.get('/eligible-sales', listEligibleDeliveryCreditsController);
  return router;
};

module.exports = { createDeliveryCreditSettlementRoute };
