'use strict'

const express = require('express')
const verifyToken = require('../../../../middlewares/verifyToken')
const requireAdmin = require('../../../../middlewares/requireAdmin')
const controller = require('./partnerStoreApplicationController')

const publicRouter = express.Router()
const adminRouter = express.Router()

publicRouter.post('/', controller.submit)

adminRouter.use(verifyToken, requireAdmin.superadmin)
adminRouter.get('/', controller.list)
adminRouter.post('/:id/approve', controller.approve)
adminRouter.post('/:id/reject', controller.reject)

module.exports = { publicRouter, adminRouter }
