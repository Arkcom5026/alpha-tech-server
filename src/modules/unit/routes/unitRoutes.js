// src/modules/unit/routes/unitRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllUnits,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit,
} = require('../runtime/unitRuntimeController');

// Preserve the existing public CRUD contract mounted at /api/units.
router.get('/', getAllUnits);
router.get('/:id', getUnitById);
router.post('/', createUnit);
router.put('/:id', updateUnit);
router.delete('/:id', deleteUnit);

module.exports = router;
