
//  @filename: server.js

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');

dotenv.config();
const app = express();
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
const orderOnlineRoutes = require("./routes/orderOnlineRoutes");
const cartRoutes = require("./routes/cartRoutes");
const branchPriceRoutes = require("./routes/branchPriceRoutes");
const branchRoutes = require('./routes/branchRoutes');
const customerDepositRoutes = require('./routes/customerDepositRoutes');
const purchaseReportRoutes = require('./routes/purchaseReportRoutes');

// ✅ Middlewares
app.use(express.json());
const allowedOrigins = [
  'http://localhost:5173',
  'https://alpha-tech-client.vercel.app',
  'https://alpha-tech-client-git-main-arkcoms-projects.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // allow Postman, curl (ไม่มี origin) และ origin ที่อยู่ใน allowedOrigins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(morgan('dev'));

// ✅ เปิดใช้งาน route
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
app.use('/api/barcodes/', barcodeRoutes);  
         
app.use("/api/sale-orders", saleRoutes);

app.use('/api/sale-returns', saleReturnRoutes);

app.use('/api/refunds', refundRoutes);

app.use('/api/payments', paymentRoutes); 
app.use('/api/supplier-payments',supplierPaymentRoutes);

app.use('/api/banks', bankRoutes);

app.use("/api/order-online", orderOnlineRoutes);

app.use("/api/cart", cartRoutes);
          
app.use("/api/branch-prices", branchPriceRoutes);

app.use('/api/branches', branchRoutes);

app.use('/api/purchase-reports',purchaseReportRoutes);



// ✅ Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.get('/', (req, res) => {
  res.send('Hello from alpha-tech-server!');
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});
