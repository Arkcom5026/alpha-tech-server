const customerMoneyReceiveService = require('./receiveCustomerMoneyService');

async function receiveCustomerMoney(req, res, next) {
  try {
    const result = await customerMoneyReceiveService.receive(req.body, req.user);
    return res.status(201).json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function listCustomerMoneyReceives(req, res, next) {
  try {
    const result = await customerMoneyReceiveService.list(req.user, req.query);
    return res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function getCustomerMoneyReceive(req, res, next) {
  try {
    const result = await customerMoneyReceiveService.getById(req.params.id, req.user);
    return res.json({ ok: true, data: result });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  receiveCustomerMoney,
  listCustomerMoneyReceives,
  getCustomerMoneyReceive,
};
