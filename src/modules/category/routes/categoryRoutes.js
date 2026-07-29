// src/modules/category/routes/categoryRoutes.js
const express = require('express');
const router = express.Router();

const {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  archiveCategory,
  restoreCategory,
  getCategoryDropdowns,
} = require('../../../../controllers/categoryController');

const verifyToken = require('../../../../middlewares/verifyToken');
const requireAdmin = require('../../../../middlewares/requireAdmin');

// Every category route requires authentication.
router.use(verifyToken);

// Keep static routes before /:id to avoid dynamic-route collisions.
router.get('/dropdowns', getCategoryDropdowns);

router.get('/', getAllCategories);
router.get('/:id', getCategoryById);

router.post('/', requireAdmin, createCategory);
router.put('/:id', requireAdmin, updateCategory);
router.patch('/:id/archive', requireAdmin, archiveCategory);
router.patch('/:id/restore', requireAdmin, restoreCategory);

module.exports = router;
