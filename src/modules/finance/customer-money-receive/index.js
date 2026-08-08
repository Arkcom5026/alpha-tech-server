const express = require('express');
const router = express.Router();

const customerMoneyReceiveRoutes = require('./routes/customerMoneyReceiveRoutes');

function mountCustomerMoneyReceiveModule(app) {
  app.use('/api/customer-money-receive', customerMoneyReceiveRoutes);
}

module.exports = {
  mountCustomerMoneyReceiveModule,
};
