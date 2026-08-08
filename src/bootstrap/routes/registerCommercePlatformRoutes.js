'use strict';

const orderOnlineRoutes = require('../../modules/commerce/order-online/routes/orderOnlineRoutes');
const cartRoutes = require('../../modules/commerce/cart/routes/cartRoutes');
const branchPriceRoutes = require('../../modules/product/pricing/routes/branchPriceRoutes');
const branchRoutes = require('../../modules/branch/routes/branchRoutes');
const partnerStoreCapabilityRoutes = require('../../modules/partnerStore/routes/partnerStoreCapabilityRoutes');
const storeExperienceDraftRoutes = require('../../modules/storeExperience/draft/storeExperienceDraftRoutes');
const {
  publicRouter: partnerStoreApplicationPublicRoutes,
  adminRouter: partnerStoreApplicationAdminRoutes,
} = require('../../modules/partnerStore/application/partnerStoreApplicationRoutes');

const registerCommercePlatformRoutes = (app) => {
  app.use('/api/order-online', orderOnlineRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/branch-prices', branchPriceRoutes);
  app.use('/api/branches', branchRoutes);
  app.use('/api/partner-store', partnerStoreCapabilityRoutes);
  app.use('/api/store-experience', storeExperienceDraftRoutes);
  app.use('/api/public/partner-store-applications', partnerStoreApplicationPublicRoutes);
  app.use('/api/partner-store/applications', partnerStoreApplicationAdminRoutes);
};

module.exports = { registerCommercePlatformRoutes };
