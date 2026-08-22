'use strict';

const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const controller = require('./storeExperienceDraftController');
const storefrontMediaRoutes = require('../media/storefrontMediaRoutes');
const {
  STORE_EXPERIENCE_CAPABILITY,
  allowStoreExperienceCapabilities,
} = require('../shared/storeExperienceAuthorization');

const router = express.Router();

const allowRead = allowStoreExperienceCapabilities(STORE_EXPERIENCE_CAPABILITY.READ);
const allowManage = allowStoreExperienceCapabilities(
  STORE_EXPERIENCE_CAPABILITY.READ,
  STORE_EXPERIENCE_CAPABILITY.MANAGE,
);
const allowPublish = allowStoreExperienceCapabilities(
  STORE_EXPERIENCE_CAPABILITY.READ,
  STORE_EXPERIENCE_CAPABILITY.MANAGE,
  STORE_EXPERIENCE_CAPABILITY.PUBLISH,
);

router.use('/media', storefrontMediaRoutes);
router.use(verifyToken);
router.get('/draft', allowRead, controller.getCurrentDraft);
router.put('/draft', allowManage, controller.saveCurrentDraft);
router.post('/publish', allowPublish, controller.publishCurrentStorefront);
router.post('/unpublish', allowPublish, controller.unpublishCurrentStorefront);

module.exports = router;
