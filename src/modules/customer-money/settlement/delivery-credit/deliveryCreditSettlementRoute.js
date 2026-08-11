'use strict';

const express = require('express');
const {
  listEligibleDeliveryCreditsController,
  createDeliveryCreditSettlementController,
  listDeliveryCreditSettlementsController,
  getDeliveryCreditSettlementController,
  cancelDeliveryCreditSettlementController,
} = require('./deliveryCreditSettlementController');

const createDeliveryCreditSettlementRoute = ({ verifyToken, runtime }) => {
  const router = express.Router();
  router.use(verifyToken);
  router.use((req, _res, next) => {
    req.customerMoneyDeliverySettlement = runtime;
    next();
  });
  router.get('/eligible-sales', listEligibleDeliveryCreditsController);
  router.get('/', listDeliveryCreditSettlementsController);
  router.get('/:id', getDeliveryCreditSettlementController);
  router.post('/', createDeliveryCreditSettlementController);
  router.post('/:id/cancel', cancelDeliveryCreditSettlementController);
  return router;
};

module.exports = { createDeliveryCreditSettlementRoute };