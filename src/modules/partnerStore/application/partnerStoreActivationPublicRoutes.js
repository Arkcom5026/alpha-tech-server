'use strict'

const express = require('express')
const controller = require('./partnerStoreActivationController')

const router = express.Router()

router.post('/claim', controller.claim)

module.exports = router
