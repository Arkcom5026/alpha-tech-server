'use strict';

const authRoutes = require('../../modules/auth/routes/sessionAuthRoutes');
const employeeRoutes = require('../../modules/employee/routes/employeeRoutes');
const supplierRoutes = require('../../modules/supplier/routes/supplierRoutes');
const unitRoutes = require('../../modules/unit/routes/unitRoutes');
const categoryRoutes = require('../../modules/category/routes/categoryRoutes');
const superAdminCategoryRoutes = require('../../modules/category/routes/superAdminCategoryRoutes');
const customerRoutes = require('../../modules/customer/routes/customerRoutes');
const customerDepositRoutes = require('../../modules/finance/customer-deposit/routes/customerDepositRoutes');
const customerReceiptRoutes = require('../../modules/finance/customer-receipt/routes/customerReceiptRoutes');
const productTypeRoutes = require('../../modules/productType/routes/productTypeRoutes');
const productProfileRoutes = require('../../modules/product/profile/routes/productProfileRoutes');
const brandRoutes = require('../../modules/brand/routes/brandRoutes');
const productTypeBrandRoutes = require('../../modules/brand/routes/productTypeBrandRoutes');
const productTemplateRoutes = require('../../modules/productTemplate/routes/productTemplateRoutes');
const { mountProductModule } = require('../../modules/product');

const registerIdentityCustomerCatalogRoutes = (app) => {
  app.use('/api/auth', authRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/suppliers', supplierRoutes);
  app.use('/api/units', unitRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/superadmin/categories', superAdminCategoryRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/customer-deposits', customerDepositRoutes);
  app.use('/api/customer-receipts', customerReceiptRoutes);
  app.use('/api/product-types', productTypeRoutes);
  app.use('/api/product-profiles', productProfileRoutes);
  app.use('/api/brands', brandRoutes);
  app.use('/api/product-type-brands', productTypeBrandRoutes);
  app.use('/api/product-templates', productTemplateRoutes);
  mountProductModule(app);
};

module.exports = { registerIdentityCustomerCatalogRoutes };
