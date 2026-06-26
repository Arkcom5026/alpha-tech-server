// src/modules/auth/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const tenantContext = require('../../../middlewares/tenantContext');

router.post('/:tenant_slug/auth/login', tenantContext, authController.login);

module.exports = router;