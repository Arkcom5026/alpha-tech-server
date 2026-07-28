'use strict'

const express = require('express')

const verifyToken = require('../../../../../middlewares/verifyToken')
const {
  ensureDraft,
  saveItemDraft,
  deleteItemDraft,
  finalize,
} = require('../legacy/quickReceiptController')

const router = express.Router()

router.use(verifyToken)

router.post('/', ensureDraft)
router.post('/:id/items', saveItemDraft)
router.delete('/:id/items/:itemId', deleteItemDraft)
router.post('/:id/finalize', finalize)

module.exports = router
