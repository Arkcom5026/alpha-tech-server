// ✅ routes/authRoutes.js (CommonJS)
const express = require('express');
const router = express.Router();

const {
  login,
  register,
  findUserByEmail,
} = require('../controllers/authController');
const { verifyToken } = require('../middlewares/verifyToken');


// 🔐 Login & Register
router.post('/login', login);
router.post('/register', register);

// 🔍 Find user by email (for employee approval)
router.get('/users/find', verifyToken, findUserByEmail);

module.exports = router;
