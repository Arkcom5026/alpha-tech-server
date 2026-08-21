//  @filename: server.js

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const { compactError, recordIncident } = require('./src/observability/runtimeIncidentLogger');

dotenv.config();
const app = express();

// Trust proxy (Render / reverse proxy)
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.disable('etag');

const normalizeRequestId = (value) => {
  const candidate = String(value || '').trim();
  if (!candidate || candidate.length > 128) return null;
  return /^[A-Za-z0-9._:-]+$/.test(candidate) ? candidate : null;
};

// Request ID (for logs / support / client-server correlation)
app.use((req, res, next) => {
  req.id = normalizeRequestId(req.get('X-Request-Id')) || (crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  res.setHeader('X-Request-Id', req.id);
  next();
});

// ===================== Routes =====================
const authRoutes = require('./src/modules/auth/routes/sessionAuthRoutes');
const productTypeRoutes = require('./src/modules/productType/routes/productTypeRoutes');
const categoryRoutes = require('./src/modules/category/routes/categoryRoutes');
const superAdminCategoryRoutes = require('./src/modules/category/routes/superAdminCategoryRoutes');
const employeeRoutes = require('./src/modules/employee/routes/employeeRoutes');
const supplierRoutes = require('./src/modules/supplier/routes/supplierRoutes');
const productTemplateRoutes = require('./src/modules/productTemplate/routes/productTemplateRoutes');
const productProfileRoutes = require('./src/modules/product/profile/routes/productProfileRoutes');
const brandRoutes = require('./src/modules/brand/routes/brandRoutes');
const unitRoutes = require('./src/modules/unit/routes/unitRoutes');
const { mountProductModule } = require('./src/modules/product');
const repairRoutes = require('./src/modules/repair/routes/repairRoutes');
const communicationRoutes = require('./src/modules/communication/communicationRoutes');
const uploadProductRoutes = require('./src/modules/product/media/routes/uploadProductRoutes');
const purchaseOrderRoutes = require('./src/modules/procurement/purchase-order/routes/purchaseOrderRoutes');
const purchaseOrderReceiptRoutes = require('./src/modules/procurement/receipt/routes/purchaseOrderReceiptRoutes');
const purchaseOrderReceiptItemRoutes = require('./src/modules/procurement/receipt/routes/purchaseOrderReceiptItemRoutes');
const stockItemRoutes = require('./src/modules/inventory/stock-item/routes/stockItemRoutes');
const barcodeRoutes = require('./src/modules/inventory/barcode/routes/barcodeRoutes');
const customerRoutes = require('./src/modules/customer/routes/customerRoutes');
const saleRoutes = require('./src/modules/sales/routes/saleRoutes');
const publicStorefrontRoutes = require('./src/modules/sales/storefront/public/publicStorefrontRoutes');
const anonymousShoppingSessionRoutes = require('./src/modules/sales/storefront/session/anonymousShoppingSessionRoutes');
const commerceIdentityRoutes = require('./src/modules/sales/storefront/identity/commerceIdentityRoutes');
const productReservationCommitmentRoutes = require('./src/modules/sales/storefront/commitment/productReservationCommitmentRoutes');
const productReservationMerchantRoutes = require('./src/modules/sales/reservations/merchant/productReservationMerchantRoutes');
const productReservationExpiryRoutes = require('./src/modules/sales/reservations/expiry/productReservationExpiryRoutes');
const paymentRoutes = require('./src/modules/sales/payment/routes/paymentRoutes');
const saleReturnRoutes = require('./src/modules/sales/return/routes/saleReturnRoutes');
const refundRoutes = require('./src/modules/sales/refund/routes/refundRoutes');
const supplierPaymentRoutes = require('./src/modules/procurement/supplier-payment/routes/supplierPaymentRoutes');
const supplierPayableRoutes = require('./src/modules/procurement/payables/http/supplierPayableRoutes');
const supplierPaymentAllocationRoutes = require('./src/modules/procurement/payments/http/supplierPaymentAllocationRoutes');
const supplierAdvanceRoutes = require('./src/modules/procurement/advances/http/supplierAdvanceRoutes');
const bankRoutes = require('./src/modules/finance/bank/routes/bankRoutes');
const orderOnlineRoutes = require('./src/modules/commerce/order-online/routes/orderOnlineRoutes');
const cartRoutes = require('./src/modules/commerce/cart/routes/cartRoutes');
const branchPriceRoutes = require('./src/modules/product/pricing/routes/branchPriceRoutes');
const branchRoutes = require('./src/modules/branch/routes/branchRoutes');
const partnerStoreCapabilityRoutes = require('./src/modules/partnerStore/routes/partnerStoreCapabilityRoutes');
const storeExperienceDraftRoutes = require('./src/modules/storeExperience/draft/storeExperienceDraftRoutes');
const { publicRouter: partnerStoreApplicationPublicRoutes, adminRouter: partnerStoreApplicationAdminRoutes } = require('./src/modules/partnerStore/application/partnerStoreApplicationRoutes');
const customerDepositRoutes = require('./src/modules/finance/customer-deposit/routes/customerDepositRoutes');
const purchaseReportRoutes = require('./src/modules/reporting/purchase/routes/purchaseReportRoutes');
const inputTaxReportRoutes = require('./src/modules/reporting/tax/input/routes/inputTaxReportRoutes');
const combinedBillingRoutes = require('./src/modules/finance/combined-billing/routes/combinedBillingRoutes');
const salesReportRoutes = require('./src/modules/reporting/sales/routes/salesReportRoutes');
const uploadSlipRoutes = require('./src/modules/commerce/payment-slip/routes/uploadSlipRoutes');
const stockAuditRoutes = require('./src/modules/inventory/audit/routes/stockAuditRoutes');
const positionRoutes = require('./src/modules/position/routes/positionRoutes');
const addressRoutes = require('./src/modules/location/routes/addressRoutes');
const locationsRoutes = require('./src/modules/location/routes/locationsRoutes');
const receiptSimpleRoutes = require('./src/modules/procurement/receipt/simple/routes/receiptSimpleRoutes');
const quickReceiptRoutes = require('./src/modules/inventory/quick-receipt/routes/quickReceiptRoutes');
const stockRoutes = require('./src/modules/inventory/dashboard/routes/stockDashboardRoutes');
const financeRoutes = require('./src/modules/finance/routes/financeRuntimeRoutes');
const customerReceiptRoutes = require('./src/modules/finance/customer-receipt/routes/customerReceiptRoutes');
const productTypeBrandRoutes = require('./src/modules/brand/routes/productTypeBrandRoutes');
const taxPeriodRoutes = require('./src/modules/tax/periods/taxPeriodRoutes');
const taxIntakeRoutes = require('./src/modules/tax/http/taxIntakeRoutes');
const taxExpenseRoutes = require('./src/modules/tax-expense/routes/taxExpenseRoutes');
const simpleStockRoutes = require('./src/modules/inventory/simple-stock/routes/simpleStockRoutes');
const missingCostResolutionReadRoutes = require('./src/modules/inventory/recovery/missing-cost-resolution/runtime/routes/missingCostResolutionReadRoutes');
const missingCostResolutionMutationRoutes = require('./src/modules/inventory/recovery/missing-cost-resolution/runtime/routes/missingCostResolutionMutationRoutes');
const missingCostResolutionRecoveryPreviewRoutes = require('./src/modules/inventory/recovery/missing-cost-resolution/runtime/routes/missingCostResolutionRecoveryPreviewRoutes');
const missingCostResolutionRecoveryExecutionRoutes = require('./src/modules/inventory/recovery/missing-cost-resolution/runtime/routes/missingCostResolutionRecoveryExecutionRoutes');
const operationalVerificationRoutes = require('./src/modules/system/operational-verification/operationalVerificationRoutes');
const storeDeviceRoutes = require('./src/modules/storeDevice/routes/storeDeviceRoutes');
const documentPurposeRoutes = require('./src/modules/document-purpose/http/documentPurposeRoutes');
const { mountCustomerMoneyReceiveModule } = require('./src/modules/customer-money/receive/registerCustomerMoneyReceive');
const { mountDeliveryCreditSettlementModule } = require('./src/modules/customer-money/settlement/delivery-credit/registerDeliveryCreditSettlement');

// ===================== Middleware =====================
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174', // dedicated local Browser E2E client
  'http://localhost:3000',
  'https://saduaksabuy.com',
  'https://www.saduaksabuy.com',
  'https://alpha-tech-client.vercel.app',
  'https://alpha-tech-client-git-main-arkcoms-projects.vercel.app',
];

const allowedOriginRegexes = [
  /^https:\/\/alpha-tech-client-[a-z0-9-]+\.vercel\.app$/i,
  /^https:\/\/alpha-tech-client-git-[a-z0-9-]+-arkcoms-projects\.vercel\.app$/i,
  /.*arkcoms-projects\.vercel\.app$/i
];

const normalizeOrigin = (value) => {
  if (!value || typeof value !== 'string') return null;
  return value.trim().replace(/\/$/, '').toLowerCase();
};

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  const o = normalizeOrigin(origin);
  if (!o) return true;
  const allowed = allowedOrigins.map(normalizeOrigin);
  if (allowed.includes(o)) return true;
  const raw = origin.trim().replace(/\/$/, '');
  return allowedOriginRegexes.some((r) => r.test(raw));
};

const corsOptions = {
  origin(origin, callback) {
    if (process.env.CORS_ALLOW_ALL === 'true') return callback(null, true);
    if (!origin || isAllowedOrigin(origin)) return callback(null, true);
    console.warn(`🚨 CORS Blocked for origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-Id',
    'X-Idempotency-Key',
    'X-Finalize-Token',
    'X-Anonymous-Session-Token',
    'X-Commerce-Identity-Proof',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['X-Request-Id', 'X-Anonymous-Session-Token', 'X-Commerce-Identity-Proof'],
  credentials: true,
  maxAge: 86400,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

morgan.token('reqId', (req) => req.id);
app.use(morgan(':method :url :status :res[content-length] - :response-time ms - reqId=:reqId'));

app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

const { traceRequest } = require('./middlewares/authTrace');
app.use('/api', traceRequest);

// ===================== API =====================
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

app.use('/api/repairs', repairRoutes);
app.use('/api/repair', repairRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/purchase-order-receipts', purchaseOrderReceiptRoutes);
app.use('/api/purchase-order-receipt-items', purchaseOrderReceiptItemRoutes);
app.use('/api/stock-items', stockItemRoutes);
app.use('/api/barcodes', barcodeRoutes);
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
app.use('/api/supplier-payments', supplierPaymentRoutes);
app.use('/api/supplier-payables', supplierPayableRoutes);
app.use('/api/supplier-settlements', supplierPaymentAllocationRoutes);
app.use('/api/supplier-advances', supplierAdvanceRoutes);
app.use('/api/banks', bankRoutes);
app.use('/api/order-online', orderOnlineRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/branch-prices', branchPriceRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/partner-store', partnerStoreCapabilityRoutes);
app.use('/api/store-experience', storeExperienceDraftRoutes);
app.use('/api/public/partner-store-applications', partnerStoreApplicationPublicRoutes);
app.use('/api/partner-store/applications', partnerStoreApplicationAdminRoutes);
app.use('/api/purchase-reports', purchaseReportRoutes);
app.use('/api/input-tax-reports', inputTaxReportRoutes);
app.use('/api/combined-billing', combinedBillingRoutes);
app.use('/api/sales-reports', salesReportRoutes);
app.use('/api/upload-slip', uploadSlipRoutes);
app.use('/api/stock-audits', stockAuditRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/receipt-simple', receiptSimpleRoutes);
app.use('/api/quick-receipts', quickReceiptRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/tax-periods', taxPeriodRoutes);
app.use('/api/tax-intake', taxIntakeRoutes);
app.use('/api/tax', taxPeriodRoutes);
app.use('/api/tax', taxIntakeRoutes);
app.use('/api/tax-expenses', taxExpenseRoutes);
app.use('/api/simple-stock', simpleStockRoutes);
app.use('/api/missing-cost-resolutions', missingCostResolutionReadRoutes);
app.use('/api/missing-cost-resolutions', missingCostResolutionMutationRoutes);
app.use('/api/missing-cost-resolutions', missingCostResolutionRecoveryPreviewRoutes);
app.use('/api/missing-cost-resolutions', missingCostResolutionRecoveryExecutionRoutes);
app.use('/api/operational-verification', operationalVerificationRoutes);
app.use('/api/products/upload', uploadProductRoutes);
app.use('/api/store-devices', storeDeviceRoutes);
app.use('/api/document-purposes', documentPurposeRoutes);
mountCustomerMoneyReceiveModule(app);
mountDeliveryCreditSettlementModule(app);

// ===================== Errors =====================
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'NOT_FOUND',
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    requestId: req.id,
  });
});

app.use((err, req, res, _next) => {
  const candidateStatusCode = Number(err?.statusCode ?? err?.status);
  const statusCode =
    Number.isInteger(candidateStatusCode) &&
    candidateStatusCode >= 400 &&
    candidateStatusCode <= 599
      ? candidateStatusCode
      : 500;
  const code = err?.code || 'INTERNAL_SERVER_ERROR';

  if (statusCode >= 500) {
    recordIncident('HTTP_UNHANDLED_SERVER_ERROR', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode,
      code,
      error: compactError(err),
    });
  } else if (process.env.HTTP_CLIENT_ERROR_LOG === 'true') {
    console.warn(JSON.stringify({
      level: 'warn',
      event: 'http_client_error',
      requestId: req.id,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode,
      code,
      occurredAt: new Date().toISOString(),
    }));
  }

  res.status(statusCode).json({
    ok: false,
    error: code,
    code,
    message: err?.message || 'Internal server error',
    details: err?.details || null,
    requestId: req.id,
  });
});

// ===================== Errors =====================
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'NOT_FOUND',
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, req, res, _next) => {
  console.error('❌ Unhandled error:', err);

  const candidateStatusCode = Number(err?.statusCode ?? err?.status);
  const statusCode =
    Number.isInteger(candidateStatusCode) &&
    candidateStatusCode >= 400 &&
    candidateStatusCode <= 599
      ? candidateStatusCode
      : 500;
  const code = err?.code || 'INTERNAL_SERVER_ERROR';

  res.status(statusCode).json({
    ok: false,
    error: code,
    code,
    message: err?.message || 'Internal server error',
    details: err?.details || null,
    requestId: req.id,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

module.exports = app;
