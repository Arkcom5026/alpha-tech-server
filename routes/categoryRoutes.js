// ✅ routes/categoryRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryDropdowns, 
} = require('../controllers/categoryController');

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

router.get('/', getAllCategories);               // GET /api/categories?branchId=...
router.get('/:id', getCategoryById);             // GET /api/categories/:id?branchId=...
router.post('/', createCategory);                // POST /api/categories { name, branchId }
router.put('/:id', updateCategory);              // PUT /api/categories/:id { name, branchId }
router.delete('/:id', deleteCategory);           // DELETE /api/categories/:id { branchId }
router.get('/dropdowns', getCategoryDropdowns);  // ✅ GET /api/categories/dropdowns

module.exports = router;
