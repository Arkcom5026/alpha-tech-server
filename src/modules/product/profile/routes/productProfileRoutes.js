// src/modules/product/profile/routes/productProfileRoutes.js
const express = require('express');
const router = express.Router();

const {
  createProductProfile,
  getAllProductProfiles,
  getProductProfileById,
  updateProductProfile,
  archiveProductProfile,
  restoreProductProfile,
  getProductProfileDropdowns,
} = require('../../../../../controllers/productProfileController');

const verifyToken = require('../../../../../middlewares/verifyToken');
const requireAdmin = require('../../../../../middlewares/requireAdmin');

router.use(verifyToken);

router.get('/dropdowns', getProductProfileDropdowns);
router.get('/', getAllProductProfiles);
router.get('/:id', getProductProfileById);

router.post('/', requireAdmin, createProductProfile);
router.patch('/:id', requireAdmin, updateProductProfile);
router.patch('/:id/archive', requireAdmin, archiveProductProfile);
router.patch('/:id/restore', requireAdmin, restoreProductProfile);

module.exports = router;
