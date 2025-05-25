// ✅ routes/productTypeRoutes.js (อัปเดตให้ครบ CRUD)
const express = require('express');
const router = express.Router();
const {
  getAllProductType,
  getProductTypeById,
  createProductType,
  updateProductType,
  deleteProductType,
  getProductTypeDropdowns,
} = require('../controllers/productTypeController');
const { verifyToken } = require('../middleware/verifyToken');

router.get('/dropdowns', getProductTypeDropdowns);
router.get('/', verifyToken, getAllProductType);
router.get('/:id', verifyToken, getProductTypeById);
router.post('/', createProductType);
router.patch('/:id', updateProductType);
router.delete('/:id', deleteProductType);


module.exports = router;
