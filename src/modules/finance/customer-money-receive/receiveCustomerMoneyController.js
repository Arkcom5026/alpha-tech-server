const customerMoneyReceiveService = require('./receiveCustomerMoneyService');

async function receiveCustomerMoney(req, res, next) {
  try {
    const result = await customerMoneyReceiveService.receive(req.body, req.user);

    return res.status(201).json({
      ok: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  receiveCustomerMoney,
};
