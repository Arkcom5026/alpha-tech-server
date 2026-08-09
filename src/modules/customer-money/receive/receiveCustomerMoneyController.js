'use strict';

const receiveCustomerMoneyController = async (req, res, next) => {
  try {
    const result = await req.customerMoneyReceive.receive(req.body, req.user);
    return res.status(201).json({ ok: true, data: result.receipt, balance: result.balance });
  } catch (error) {
    return next(error);
  }
};

const listCustomerMoneyReceiveController = async (req, res, next) => {
  try {
    const result = await req.customerMoneyReceive.list(req.user, req.query);
    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const getCustomerMoneyReceiveController = async (req, res, next) => {
  try {
    const result = await req.customerMoneyReceive.getById(req.params.id, req.user);
    return res.json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  receiveCustomerMoneyController,
  listCustomerMoneyReceiveController,
  getCustomerMoneyReceiveController,
};
