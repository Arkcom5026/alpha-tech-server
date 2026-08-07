'use strict'

const express = require('express')
const verifyToken = require('../../../../middlewares/verifyToken')
const controller = require('./documentPurposeController')

const router = express.Router()

router.use(verifyToken)

router.get('/', controller.list)
router.get('/code/:code', controller.getByCode)
router.get('/:definitionId/versions', controller.listVersions)
router.get('/:definitionId/events', controller.listEvents)
router.get('/:definitionId', controller.getById)
router.post('/', controller.create)
router.patch('/:definitionId', controller.update)
router.post('/:definitionId/lifecycle', controller.lifecycle)

module.exports = router
