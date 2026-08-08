'use strict';

const publicStorefrontRoutes = require('../../modules/sales/storefront/public/publicStorefrontRoutes');
const anonymousShoppingSessionRoutes = require('../../modules/sales/storefront/session/anonymousShoppingSessionRoutes');
const commerceIdentityRoutes = require('../../modules/sales/storefront/identity/commerceIdentityRoutes');
const productReservationCommitmentRoutes = require('../../modules/sales/storefront/commitment/productReservationCommitmentRoutes');
const productReservationExpiryRoutes = require('../../modules/sales/reservations/expiry/productReservationExpiryRoutes');
const productReservationMerchantRoutes = require('../../modules/sales/reservations/merchant/productReservationMerchantRoutes');
const saleRoutes = require('../../modules/sales/routes/saleRoutes');
const saleReturnRoutes = require('../../modules/sales/return/routes/saleReturnRoutes');
const refundRoutes = require('../../modules/sales/refund/routes/refundRoutes');
const paymentRoutes = require('../../modules/sales/payment/routes/paymentRoutes');

const registerSalesRoutes = (app) => {
  app.use('/api/sales/storefronts', publicStorefrontRoutes);
  app.use('/api/sales/storefronts/:slug/session', anonymousShoppingSessionRoutes);
  app.use('/api/sales/storefronts/:slug/identity', commerceIdentityRoutes);
  app.use('/api/sales/storefronts/:slug/commitment', productReservationCommitmentRoutes);
  app.use('/api/sales/reservations/expiry', productReservationExpiryRoutes);
  app.use('/api/sales/reservations', productReservationMerchantRoutes);
  app.use('/api/sales', saleRoutes);
  app.use('/api/sale-orders', saleRoutes);
  app.use('/api/sale-returns', saleReturnRoutes);
  app.use('/api/refunds', refundRoutes);
  app.use('/api/payments', paymentRoutes);
};

module.exports = { registerSalesRoutes };
