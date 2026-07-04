const express = require('express')

const router = express.Router()
const controller = require('../controllers/productExistingModelPreviewController')

router.get('/', controller.getExistingModelPreview)

module.exports = router
