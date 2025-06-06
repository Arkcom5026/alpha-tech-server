// 📁 FILE: routes/customerRoutes.js
// ✅ COMMENT: แยก controller ออกเป็นสัดส่วน

const express = require('express');
const router = express.Router();
const { quickCreateCustomer } = require('../controllers/customerController'); // ✅ import controller

// 📌 POST /api/customers/quick-create
router.post('/quick-create', quickCreateCustomer);

module.exports = router;