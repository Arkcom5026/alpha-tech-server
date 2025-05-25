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
const productTemplateRoutes = require('./routes/productTemplateRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const path = require('path');
const productRoutes = require('./routes/productRoutes');
const productProfileRoutes = require('./routes/productProfileRoutes'); // ✅
const unitRoutes = require('./routes/unitRoutes'); // ✅



const app = express();

// ✅ Middleware
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(morgan('dev'));

// ✅ เปิดใช้งาน route
app.use('/api/auth', authRoutes);
app.use('/api/product-types', productTypeRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/product-templates', productTemplateRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/upload', uploadRoutes);
app.use('/api/products', productRoutes);
app.use('/api/product-profiles', productProfileRoutes); 
app.use('/api/units', unitRoutes); 



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
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
