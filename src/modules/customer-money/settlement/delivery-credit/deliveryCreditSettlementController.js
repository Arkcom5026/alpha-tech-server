'use strict';

const listEligibleDeliveryCreditsController = async (req, res, next) => {
  try {
    const data = await req.customerMoneyDeliverySettlement.listEligible(req.query, req.user);
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

const createDeliveryCreditSettlementController = async (req, res, next) => {
  try {
    const data = await req.customerMoneyDeliverySettlement.create(req.body, req.user);
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

const listDeliveryCreditSettlementsController = async (req, res, next) => {
  try {
    const data = await req.customerMoneyDeliverySettlement.list(req.query, req.user);
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

const getDeliveryCreditSettlementController = async (req, res, next) => {
  try {
    const data = await req.customerMoneyDeliverySettlement.getById(req.params.id, req.user);
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

const cancelDeliveryCreditSettlementController = async (req, res, next) => {
  try {
    const data = await req.customerMoneyDeliverySettlement.cancel(
      req.params.id,
      req.body?.cancelReason,
      req.user,
    );
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listEligibleDeliveryCreditsController,
  createDeliveryCreditSettlementController,
  listDeliveryCreditSettlementsController,
  getDeliveryCreditSettlementController,
  cancelDeliveryCreditSettlementController,
};