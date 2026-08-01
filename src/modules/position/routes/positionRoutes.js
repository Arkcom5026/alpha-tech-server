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
} = require('../runtime/positionRuntimeController');

const verifyToken = require('../../../../middlewares/verifyToken');
const requireAdmin = require('../../../../middlewares/requireAdmin');

router.use(verifyToken);

router.get('/dropdowns', getDropdowns);
router.get('/', listPositions);
router.get('/:id', getById);

router.post('/', requireAdmin, createPosition);
router.patch('/:id', requireAdmin, updatePosition);
router.patch('/:id/toggle-active', requireAdmin, toggleActive);
router.delete('/:id', requireAdmin, hardDelete);

module.exports = router;
