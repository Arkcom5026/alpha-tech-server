// ✅ routes/bankRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/verifyToken');
const {
  getAllBanks,
  getBankById,
  createBank,
  updateBank,
  deleteBank,
} = require('../controllers/bankController');

// ✅ Auth middleware สำหรับทุกเส้นทางของธนาคาร
router.use(verifyToken);

// GET /api/banks
router.get('/', getAllBanks);

// GET /api/banks/:id
router.get('/:id', getBankById);

// POST /api/banks
router.post('/', createBank);

// PATCH /api/banks/:id
router.patch('/:id', updateBank);

// DELETE /api/banks/:id
router.delete('/:id', deleteBank);

module.exports = router;
