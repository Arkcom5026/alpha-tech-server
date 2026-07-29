//  @filename: server.js

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

dotenv.config();
const app = express();

// Trust proxy (Render / reverse proxy)
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.disable('etag');

// Request ID (for logs / support)
app.use((req, res, next) => {
  req.id = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  res.setHeader('X-Request-Id', req.id);
  next();
});

// ===================== Routes =====================
const authRoutes = require('./routes/authRoutes');
const productTypeRoutes = require('./src/modules/productType/routes/productTypeRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const superAdminCategoryRoutes = require('./routes/superAdminCategoryRoutes');
const employeeRoutes = require('./src/modules/employee/routes/employeeRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const productTemplateRoutes = require('./src/modules/productTemplate/routes/productTemplateRoutes');
const productProfileRoutes = require('./routes/productProfileRoutes');
const brandRoutes = require('./src/modules/brand/routes/brandRoutes');
const unitRoutes = require('./routes/unitRoutes');
const { mountProductModule } = require('./src/modules/product');
const repairRoutes = require('./src/modules/repair/routes/repairRoutes');
const uploadProductRoutes = require('./routes/uploadProductRoutes');
const purchaseOrderRoutes = require('./src/modules/procurement/purchase-order/routes/purchaseOrderRoutes');
const purchaseOrderReceiptRoutes = require('./src/modules/procurement/receipt/routes/purchaseOrderReceiptRoutes');
const purchaseOrderReceiptItemRoutes = require('./src/modules/procurement/receipt/routes/purchaseOrderReceiptItemRoutes');
const stockItemRoutes = require('./src/modules/inventory/stock-item/routes/stockItemRoutes');
const barcodeRoutes = require('./src/modules/inventory/barcode/routes/barcodeRoutes');
const customerRoutes = require('./src/modules/customer/routes/customerRoutes');
const saleRoutes = require('./src/modules/sales/routes/saleRoutes');
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
const branchRoutes = require('./routes/branchRoutes');
const customerDepositRoutes = require('./src/modules/finance/customer-deposit/routes/customerDepositRoutes');
const purchaseReportRoutes = require('./src/modules/reporting/purchase/routes/purchaseReportRoutes');
const inputTaxReportRoutes = require('./src/modules/reporting/tax/input/routes/inputTaxReportRoutes');
const combinedBillingRoutes = require('./src/modules/finance/combined-billing/routes/combinedBillingRoutes');
const salesReportRoutes = require('./src/modules/reporting/sales/routes/salesReportRoutes');
const uploadSlipRoutes = require('./src/modules/commerce/payment-slip/routes/uploadSlipRoutes');
const stockAuditRoutes = require('./src/modules/inventory/audit/routes/stockAuditRoutes');
const positionRoutes = require('./routes/positionRoutes');
const addressRoutes = require('./routes/addressRoutes');
const locationsRoutes = require('./routes/locationsRoutes');
const receiptSimpleRoutes = require('./src/modules/procurement/receipt/simple/routes/receiptSimpleRoutes');
const purchaseOrderReceiptSimpleRoutes = require('./routes/purchaseOrderReceiptSimpleRoutes');
const quickReceiptRoutes = require('./src/modules/inventory/quick-receipt/routes/quickReceiptRoutes');
const stockRoutes = require('./src/modules/inventory/dashboard/routes/stockDashboardRoutes');
const financeRoutes = require('./src/modules/finance/legacy-runtime/routes/financeRuntimeRoutes');
const customerReceiptRoutes = require('./src/modules/finance/customer-receipt/routes/customerReceiptRoutes');
const productTypeBrandRoutes = require('./routes/productTypeBrandRoutes');
const taxPeriodRoutes = require('./src/modules/tax/periods/taxPeriodRoutes');
const taxIntakeRoutes = require('./src/modules/tax/http/taxIntakeRoutes');
const simpleStockRoutes = require('./src/modules/inventory/simple-stock/routes/simpleStockRoutes');

// ===================== Middleware =====================
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

const allowedOrigins = [
  'http://localhost:5173',
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
    'X-Idempotency-Key',
    'X-Finalize-Token',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['X-Request-Id'],
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

app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/purchase-order-receipts', purchaseOrderReceiptRoutes);
app.use('/api/purchase-order-receipt-items', purchaseOrderReceiptItemRoutes);
app.use('/api/stock-items', stockItemRoutes);
app.use('/api/barcodes', barcodeRoutes);

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
app.use('/api/purchase-reports', purchaseReportRoutes);
app.use('/api/input-tax-reports', inputTaxReportRoutes);
app.use('/api/combined-billing', combinedBillingRoutes);
app.use('/api/sales-reports', salesReportRoutes);
app.use('/api/upload-slip', uploadSlipRoutes);
app.use('/api/stock-audit', stockAuditRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/receipts-simple', receiptSimpleRoutes);
app.use('/api/purchase-order-receipts-simple', purchaseOrderReceiptSimpleRoutes);
app.use('/api/quick-receipts', quickReceiptRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/upload-product', uploadProductRoutes);
app.use('/api/tax', taxIntakeRoutes);
app.use('/api/tax', taxPeriodRoutes);
app.use('/api/simple-stock', simpleStockRoutes);

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
