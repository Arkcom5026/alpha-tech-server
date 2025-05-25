const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/verifyToken');
const {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductDropdowns // ✅ เพิ่มเข้าไปใน destructuring
} = require('../controllers/productController');

// เส้นทาง
router.post('/', verifyToken, createProduct);
router.get('/dropdowns', verifyToken, getProductDropdowns); 
router.get('/', verifyToken, getAllProducts);
router.get('/:id', verifyToken, getProductById);
router.put('/:id', verifyToken, updateProduct);
router.delete('/:id', verifyToken, deleteProduct);


module.exports = router;


