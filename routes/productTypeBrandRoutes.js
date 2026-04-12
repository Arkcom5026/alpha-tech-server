// ✅ routes/productTypeBrandRoutes.js
const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');
const {
  attachBrandToProductType,
} = require('../controllers/productTypeBrandController');

// ✅ Auth middleware สำหรับทุกเส้นทางของ ProductTypeBrand Mapping
router.use(verifyToken);

// POST /api/product-type-brands
router.post('/', attachBrandToProductType);

module.exports = router;
