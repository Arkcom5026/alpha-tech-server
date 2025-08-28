const express = require('express');
const { catalogNormalizeMiddleware } = require('../middleware/catalogNormalize');

const { createProductType, updateProductType } = require('../controllers/productTypeController');
const { createProductProfile, updateProductProfile } = require('../controllers/productProfileController');
const { createProductTemplate, updateProductTemplate } = require('../controllers/productTemplateController');

const router = express.Router();

// ProductType
router.post('/product-types', catalogNormalizeMiddleware, createProductType);
router.patch('/product-types/:id', catalogNormalizeMiddleware, updateProductType);

// ProductProfile
router.post('/product-profiles', catalogNormalizeMiddleware, createProductProfile);
router.patch('/product-profiles/:id', catalogNormalizeMiddleware, updateProductProfile);

// ProductTemplate
router.post('/product-templates', catalogNormalizeMiddleware, createProductTemplate);
router.patch('/product-templates/:id', catalogNormalizeMiddleware, updateProductTemplate);

module.exports = router;
