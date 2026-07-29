// src/modules/position/routes/positionRoutes.js
const express = require('express');
const router = express.Router();

const {
  listPositions,
  getDropdowns,
  getById,
  createPosition,
  updatePosition,
  toggleActive,
  hardDelete,
} = require('../controllers/positionController');

const verifyToken = require('../../../../middlewares/verifyToken');
const requireAdmin = require('../../../../middlewares/requireAdmin');

// All routes require authentication.
router.use(verifyToken);

// Keep static routes before dynamic /:id routes.
router.get('/dropdowns', getDropdowns);

// Read operations are available to every authenticated user.
router.get('/', listPositions);
router.get('/:id', getById);

// Write operations require admin authority.
router.post('/', requireAdmin, createPosition);
router.patch('/:id', requireAdmin, updatePosition);
router.patch('/:id/toggle-active', requireAdmin, toggleActive);

// Hard delete remains protected by admin authority.
router.delete('/:id', requireAdmin, hardDelete);

module.exports = router;
