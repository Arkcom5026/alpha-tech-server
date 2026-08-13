'use strict'

const express = require('express')
const verifyToken = require('../../../../middlewares/verifyToken')
const requireAdmin = require('../../../../middlewares/requireAdmin')
const publicController = require('./partnerStoreApplicationPublicController')
const adminController = require('./partnerStoreApplicationController')

const publicRouter = express.Router()
const adminRouter = express.Router()

publicRouter.post('/', publicController.submit)

adminRouter.use(verifyToken, requireAdmin.superadmin)
adminRouter.get('/', adminController.list)
adminRouter.post('/:id/approve', adminController.approve)
adminRouter.post('/:id/reject', adminController.reject)

module.exports = { publicRouter, adminRouter }
