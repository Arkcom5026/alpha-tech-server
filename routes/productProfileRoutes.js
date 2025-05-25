// ✅ backend/routes/productProfileRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/productProfileController');

router.post('/', controller.createProductProfile);
router.get('/', controller.getAllProductProfiles);
router.get('/:id', controller.getProductProfileById);
router.put('/:id', controller.updateProductProfile);
router.delete('/:id', controller.deleteProductProfile);

module.exports = router;

