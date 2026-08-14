'use strict'

const express = require('express')
const verifyToken = require('../../../../middlewares/verifyToken')
const requireAdmin = require('../../../../middlewares/requireAdmin')
const publicController = require('./partnerStoreApplicationPublicController')
const adminController = require('./partnerStoreApplicationController')
const activationController = require('./partnerStoreActivationController')
const activationPublicRoutes = require('./partnerStoreActivationPublicRoutes')

const publicRouter = express.Router()
const adminRouter = express.Router()

publicRouter.post('/', publicController.submit)
publicRouter.use('/activation', activationPublicRoutes)

adminRouter.use(verifyToken, requireAdmin.superadmin)
adminRouter.get('/', adminController.list)
adminRouter.post('/:id/review', adminController.startReview)
adminRouter.post('/:id/approve', adminController.approve)
adminRouter.post('/:id/reject', adminController.reject)
adminRouter.post('/:id/provision', adminController.provision)
adminRouter.post('/:id/activation-invitations', activationController.issueInvitation)

module.exports = { publicRouter, adminRouter }
