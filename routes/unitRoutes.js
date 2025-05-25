// routes/unitRoutes.js
const express = require('express');
const router = express.Router();
const {
    getAllUnits,
    getUnitById,
    createUnit,
    updateUnit,
    deleteUnit,
  } = require('../controllers/unitController');
  

// ✅ CRUD Routes
router.get('/',  getAllUnits);         // GET /api/units
router.get('/:id', getUnitById);      // GET /api/units/:id
router.post('/', createUnit);         // POST /api/units
router.put('/:id', updateUnit);       // PUT /api/units/:id
router.delete('/:id', deleteUnit);    // DELETE /api/units/:id

module.exports = router;
