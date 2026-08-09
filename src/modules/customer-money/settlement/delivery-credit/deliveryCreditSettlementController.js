'use strict';

const listEligibleDeliveryCreditsController = async (req, res, next) => {
  try {
    const data = await req.customerMoneyDeliverySettlement.listEligible(req.query, req.user);
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

module.exports = { listEligibleDeliveryCreditsController };
