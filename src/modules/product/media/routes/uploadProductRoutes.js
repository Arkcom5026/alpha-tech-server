// src/modules/product/media/routes/uploadProductRoutes.js
const express = require('express');
const router = express.Router();

const {
  uploadProductImagesOnly,
  uploadAndSaveProductImages,
  deleteProductImage,
  setProductCoverImage,
} = require('../../../../../controllers/upload/uploadProductController');

const uploadProductMiddleware = require('../../../../../middlewares/uploadProductMiddleware');

// Upload files only (temporary). Frontend field name: files.
router.post('/images/upload', uploadProductMiddleware.array('files'), uploadProductImagesOnly);

// Upload and persist images for a product. Frontend field name: file.
router.post('/:id/images/upload-full', uploadProductMiddleware.single('file'), uploadAndSaveProductImages);

// Backward-compatible delete aliases.
router.post('/:id/images/delete', deleteProductImage);
router.delete('/:id/images/delete', deleteProductImage);
router.post('/:id/images/:imageId/delete', deleteProductImage);
router.delete('/:id/images/:imageId', deleteProductImage);

// Set one image as the product cover.
router.patch('/:id/images/:imageId/cover', setProductCoverImage);

module.exports = router;
