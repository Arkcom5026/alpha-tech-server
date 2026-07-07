const express = require('express');
const { catalogNormalizeMiddleware } = require('../middleware/catalogNormalize');

const { createProductType, updateProductType } = require('../controllers/productTypeController');
const { createProductProfile, updateProductProfile } = require('../controllers/productProfileController');
const { createProductTemplate, updateProductTemplate } = require('../controllers/productTemplateController');

const router = express.Router();

// ProductType no longer uses slug as runtime identity.
// The ProductType controller owns normalizedName from name + GlobalProductType context.
router.post('/product-types', createProductType);
router.patch('/product-types/:id', updateProductType);

// ProductProfile still owns legacy slug.
router.post('/product-profiles', catalogNormalizeMiddleware, createProductProfile);
router.patch('/product-profiles/:id', catalogNormalizeMiddleware, updateProductProfile);

// ProductTemplate still owns legacy slug.
router.post('/product-templates', catalogNormalizeMiddleware, createProductTemplate);
router.patch('/product-templates/:id', catalogNormalizeMiddleware, updateProductTemplate);

module.exports = router;
