// ✅ routes/bankRoutes.js
const express = require('express');
const router = express.Router();
const { getAllBanks } = require('../controllers/bankController');
const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

// GET /api/banks
router.get('/', getAllBanks);

module.exports = router;
