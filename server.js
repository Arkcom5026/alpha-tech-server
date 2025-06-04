
//  @filename: server.js

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');

dotenv.config();

const authRoutes = require('./routes/authRoutes'); // ✅ ต้องมี
const productTypeRoutes = require('./routes/productTypeRoutes'); // ✅ ต้องมี
const categoryRoutes = require('./routes/categoryRoutes'); // ✅ ต้องมี
const employeeRoutes = require('./routes/employeeRoutes'); // ✅ ต้องมี
const supplierRoutes = require('./routes/supplierRoutes');
const productTemplateRoutes = require('./routes/productTemplateRoutes'); // ✅ CRUD


const uploadProductTemplateRoutes = require('./routes/uploadProductTemplateRoutes'); // ✅ upload image
const productProfileRoutes = require('./routes/productProfileRoutes'); // ✅
const unitRoutes = require('./routes/unitRoutes'); // ✅
const app = express();
const productRoutes = require('./routes/productRoutes');

const uploadProductRoutes = require('./routes/uploadProductRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const purchaseOrderReceiptRoutes = require('./routes/purchaseOrderReceiptRoutes');
const purchaseOrderReceiptItemRoutes = require('./routes/purchaseOrderReceiptItemRoutes');
const stockItemRoutes = require('./routes/stockItemRoutes');
const barcodeRoutes = require('./routes/barcodeRoutes');

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
app.use('/api/product-types', productTypeRoutes);
app.use('/api/product-profiles', productProfileRoutes); 
app.use('/api/product-templates', productTemplateRoutes); // ✅ route สำหรับ CRUD หลัก


app.use('/api/products', uploadProductRoutes);
app.use('/api/products-templates', uploadProductTemplateRoutes);


app.use('/api/products', productRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
              
app.use('/api/purchase-order-receipts', purchaseOrderReceiptRoutes);
app.use('/api/purchase-order-receipt-items', purchaseOrderReceiptItemRoutes);
              
             
app.use('/api/stock-items', stockItemRoutes);  
         ///api/stock-items/receive-sn 

app.use('/api/barcodes/', barcodeRoutes);  
      


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
