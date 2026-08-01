// ===============================
// superAdminCategoryRoutes.js
// Module-owned Superadmin Category HTTP boundary
// ===============================

const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const {
  getAllSuperAdminCategories,
  createSuperAdminCategory,
  updateSuperAdminCategory,
} = require('../super-admin/runtime/superAdminCategoryRuntimeController');

const router = express.Router();

const requireSuperAdmin = (req, res, next) => {
  try {
    const role = String(req.user && req.user.role ? req.user.role : '').trim().toUpperCase();

    if (role !== 'SUPERADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return next();
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden' });
  }
};

router.use(verifyToken);
router.use(requireSuperAdmin);

router.get('/', getAllSuperAdminCategories);
router.post('/', createSuperAdminCategory);
router.put('/:id', updateSuperAdminCategory);

module.exports = router;
