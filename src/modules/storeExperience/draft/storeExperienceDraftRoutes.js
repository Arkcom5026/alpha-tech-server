'use strict';

const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const controller = require('./storeExperienceDraftController');
const storefrontMediaRoutes = require('../media/storefrontMediaRoutes');
const { allowStoreExperienceManage } = require('../shared/storeExperienceAuthorization');

const router = express.Router();

router.use('/media', storefrontMediaRoutes);
router.use(verifyToken, allowStoreExperienceManage);
router.get('/draft', controller.getCurrentDraft);
router.put('/draft', controller.saveCurrentDraft);
router.post('/publish', controller.publishCurrentStorefront);
router.post('/unpublish', controller.unpublishCurrentStorefront);

module.exports = router;
