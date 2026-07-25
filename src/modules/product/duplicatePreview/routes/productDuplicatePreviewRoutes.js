const express = require('express')

const router = express.Router()
const controller = require('../controllers/productDuplicatePreviewController')

router.get('/', controller.getExistingModelPreview)

module.exports = router
