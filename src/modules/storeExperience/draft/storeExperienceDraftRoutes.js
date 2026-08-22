'use strict';

const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const controller = require('./storeExperienceDraftController');
const storefrontMediaRoutes = require('../media/storefrontMediaRoutes');
const {
  STORE_EXPERIENCE_CAPABILITIES,
  allowStoreExperienceCapabilities,
} = require('../shared/storeExperienceAuthorization');

const router = express.Router();
const canRead = allowStoreExperienceCapabilities(STORE_EXPERIENCE_CAPABILITIES.READ);
const canManage = allowStoreExperienceCapabilities(
  STORE_EXPERIENCE_CAPABILITIES.READ,
  STORE_EXPERIENCE_CAPABILITIES.MANAGE,
);
const canPublish = allowStoreExperienceCapabilities(
  STORE_EXPERIENCE_CAPABILITIES.READ,
  STORE_EXPERIENCE_CAPABILITIES.MANAGE,
  STORE_EXPERIENCE_CAPABILITIES.PUBLISH,
);

router.use('/media', storefrontMediaRoutes);
router.use(verifyToken);
router.get('/draft', canRead, controller.getCurrentDraft);
router.put('/draft', canManage, controller.saveCurrentDraft);
router.post('/publish', canPublish, controller.publishCurrentStorefront);
router.post('/unpublish', canPublish, controller.unpublishCurrentStorefront);

module.exports = router;
