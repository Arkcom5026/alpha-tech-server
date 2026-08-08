'use strict';

const receiveCustomerMoneyController = async (req, res, next) => {
  try {
    const result = await req.receiveCustomerMoneyService(req.body);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
};

module.exports = { receiveCustomerMoneyController };
