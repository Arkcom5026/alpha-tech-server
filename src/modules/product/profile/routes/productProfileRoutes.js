// src/modules/product/profile/routes/productProfileRoutes.js
const express = require('express');
const router = express.Router();

const verifyToken = require('../../../../../middlewares/verifyToken');
const requireAdmin = require('../../../../../middlewares/requireAdmin');

// ProductProfile/ProductTemplate models are absent from the current Prisma schema.
// Preserve the authenticated API surface with an explicit retirement response.
const retired = (_req, res) =>
  res.status(410).json({
    error: 'FEATURE_RETIRED',
    code: 'PRODUCT_PROFILE_REMOVED',
    message: 'ProductProfile ถูกถอดออกจาก Product Runtime ปัจจุบันแล้ว',
  });

router.use(verifyToken);

router.get('/dropdowns', retired);
router.get('/', retired);
router.get('/:id', retired);

router.post('/', requireAdmin, retired);
router.patch('/:id', requireAdmin, retired);
router.patch('/:id/archive', requireAdmin, retired);
router.patch('/:id/restore', requireAdmin, retired);

module.exports = router;
