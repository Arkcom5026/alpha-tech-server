'use strict'

const express = require('express')
const verifyToken = require('../../../../middlewares/verifyToken')
const controller = require('./documentPurposeController')
const printRouteController = require('../print-route/documentPurposePrintRouteController')

const router = express.Router()

router.use(verifyToken)

router.get('/', controller.list)
router.get('/print-routes', printRouteController.list)
router.get('/code/:code', controller.getByCode)
router.get('/:definitionId/versions', controller.listVersions)
router.get('/:definitionId/events', controller.listEvents)
router.get('/:definitionId/print-route', printRouteController.get)
router.put('/:definitionId/print-route', printRouteController.configure)
router.delete('/:definitionId/print-route', printRouteController.disable)
router.get('/:definitionId', controller.getById)
router.post('/', controller.create)
router.patch('/:definitionId', controller.update)
router.post('/:definitionId/lifecycle', controller.lifecycle)

module.exports = router
