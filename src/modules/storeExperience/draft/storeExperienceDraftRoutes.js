'use strict';

const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const controller = require('./storeExperienceDraftController');
const storefrontMediaRoutes = require('../media/storefrontMediaRoutes');
const {
  STORE_EXPERIENCE_CAPABILITY,
  requireStoreExperienceEmployeeContext,
  allowStoreExperienceCapabilities,
} = require('../shared/storeExperienceAuthorization');

const router = express.Router();
const canRead = allowStoreExperienceCapabilities(STORE_EXPERIENCE_CAPABILITY.READ);
const canManage = allowStoreExperienceCapabilities(
  STORE_EXPERIENCE_CAPABILITY.READ,
  STORE_EXPERIENCE_CAPABILITY.MANAGE,
);
const canPublish = allowStoreExperienceCapabilities(
  STORE_EXPERIENCE_CAPABILITY.READ,
  STORE_EXPERIENCE_CAPABILITY.MANAGE,
  STORE_EXPERIENCE_CAPABILITY.PUBLISH,
);

router.use('/media', storefrontMediaRoutes);
router.use(verifyToken, requireStoreExperienceEmployeeContext);
router.get('/draft', canRead, controller.getCurrentDraft);
router.put('/draft', canManage, controller.saveCurrentDraft);
router.post('/publish', canPublish, controller.publishCurrentStorefront);
router.post('/unpublish', canPublish, controller.unpublishCurrentStorefront);

module.exports = router;
