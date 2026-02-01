//  @filename: server.js

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const crypto = require('crypto');

dotenv.config();
const app = express();

// Trust proxy (Render / reverse proxy)
app.set('trust proxy', 1);
app.disable('x-powered-by');

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
const productTypeRoutes = require('./routes/productTypeRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const productTemplateRoutes = require('./routes/productTemplateRoutes');
const productProfileRoutes = require('./routes/productProfileRoutes');
const unitRoutes = require('./routes/unitRoutes');
const productRoutes = require('./routes/productRoutes');
const uploadProductRoutes = require('./routes/uploadProductRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const purchaseOrderReceiptRoutes = require('./routes/purchaseOrderReceiptRoutes');
const purchaseOrderReceiptItemRoutes = require('./routes/purchaseOrderReceiptItemRoutes');
const stockItemRoutes = require('./routes/stockItemRoutes');
const barcodeRoutes = require('./routes/barcodeRoutes');
const customerRoutes = require('./routes/customerRoutes');
const saleRoutes = require('./routes/saleRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const saleReturnRoutes = require('./routes/saleReturnRoutes');
const refundRoutes = require('./routes/refundRoutes');
const supplierPaymentRoutes = require('./routes/supplierPaymentRoutes');
const bankRoutes = require('./routes/bankRoutes');
const orderOnlineRoutes = require('./routes/orderOnlineRoutes');
const cartRoutes = require('./routes/cartRoutes');
const branchPriceRoutes = require('./routes/branchPriceRoutes');
const branchRoutes = require('./routes/branchRoutes');
const customerDepositRoutes = require('./routes/customerDepositRoutes');
const purchaseReportRoutes = require('./routes/purchaseReportRoutes');
const inputTaxReportRoutes = require('./routes/inputTaxReportRoutes');
const combinedBillingRoutes = require('./routes/combinedBillingRoutes');
const salesReportRoutes = require('./routes/salesReportRoutes');
const uploadSlipRoutes = require('./routes/uploadSlipRoutes');
const stockAuditRoutes = require('./routes/stockAuditRoutes');
const positionRoutes = require('./routes/positionRoutes');
const addressRoutes = require('./routes/addressRoutes');
const locationsRoutes = require('./routes/locationsRoutes');
const receiptSimpleRoutes = require('./routes/receiptSimpleRoutes');
const purchaseOrderReceiptSimpleRoutes = require('./routes/purchaseOrderReceiptSimpleRoutes');
const quickReceiptRoutes = require('./routes/quickReceiptRoutes');

// Optional SIMPLE routes
let simpleStockRoutes = null;
try {
  simpleStockRoutes = require('./routes/simpleStockRoutes');
} catch (e) {
  console.warn('⚠️ SIMPLE routes not loaded:', e.message);
}

// ===================== Middleware =====================
app.use(express.json({ limit: '2mb' }));

const allowedOrigins = [
  'http://localhost:5173',
  'https://alpha-tech-client.vercel.app',
  'https://alpha-tech-client-git-main-arkcoms-projects.vercel.app',
  'https://saduaksabuy.com',
  'https://www.saduaksabuy.com',
  'https://www.saduaksabuy.com',
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key', 'X-Finalize-Token'],
  credentials: true,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

morgan.token('reqId', (req) => req.id);
app.use(morgan(':method :url :status :res[content-length] - :response-time ms - reqId=:reqId'));

// ===================== API =====================
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/customer-deposits', customerDepositRoutes);
app.use('/api/product-types', productTypeRoutes);
app.use('/api/product-profiles', productProfileRoutes);
app.use('/api/product-templates', productTemplateRoutes);
app.use('/api/products', productRoutes);
app.use('/api/products', uploadProductRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/purchase-order-receipts', purchaseOrderReceiptRoutes);
app.use('/api/purchase-order-receipt-items', purchaseOrderReceiptItemRoutes);
app.use('/api/stock-items', stockItemRoutes);
app.use('/api/barcodes', barcodeRoutes);
app.use('/api/sale-orders', saleRoutes);
app.use('/api/sale-returns', saleReturnRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/supplier-payments', supplierPaymentRoutes);
app.use('/api/banks', bankRoutes);
app.use('/api/order-online', orderOnlineRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/branch-prices', branchPriceRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/purchase-reports', purchaseReportRoutes);
app.use('/api/input-tax-reports', inputTaxReportRoutes);
app.use('/api/combined-billing', combinedBillingRoutes);
app.use('/api/sales-reports', salesReportRoutes);
app.use('/api/upload-slips', uploadSlipRoutes);
app.use('/api/stock-audit', stockAuditRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/locations', locationsRoutes);
app.use('/api/receipts/simple', receiptSimpleRoutes);
app.use('/api/po-receipts/simple', purchaseOrderReceiptSimpleRoutes);
app.use('/api/quick-receipts', quickReceiptRoutes);

if (simpleStockRoutes) {
  app.use('/api/simple', simpleStockRoutes);
  console.log('✅ SIMPLE routes mounted at /api/simple');
}

// ===================== Public =====================
app.get('/', (req, res) => {
  res.send('Hello from alpha-tech-server!');
});

app.get('/healthz', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// ===================== Errors =====================
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Not Found',
    path: req.originalUrl,
    reqId: req.id,
  });
});

app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      ok: false,
      error: 'CORS Forbidden',
      origin: req.headers.origin || null,
      reqId: req.id,
    });
  }

  if (status >= 400 && status < 500) {
    return res.status(status).json({
      ok: false,
      error: err.message || 'Bad Request',
      reqId: req.id,
    });
  }

  console.error('❌ Server Error', {
    reqId: req.id,
    status,
    message: err.message,
    path: req.originalUrl,
    method: req.method,
  });

  return res.status(500).json({
    ok: false,
    error: 'Internal Server Error',
    reqId: req.id,
  });
});

// ===================== Start =====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});



