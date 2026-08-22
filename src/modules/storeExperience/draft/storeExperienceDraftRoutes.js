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

router.use('/media', storefrontMediaRoutes);
router.use(verifyToken);
router.get(
  '/draft',
  allowStoreExperienceCapabilities(STORE_EXPERIENCE_CAPABILITY.READ),
  controller.getCurrentDraft,
);
router.put(
  '/draft',
  allowStoreExperienceCapabilities(
    STORE_EXPERIENCE_CAPABILITY.READ,
    STORE_EXPERIENCE_CAPABILITY.MANAGE,
  ),
  controller.saveCurrentDraft,
);
router.post(
  '/publish',
  allowStoreExperienceCapabilities(
    STORE_EXPERIENCE_CAPABILITY.READ,
    STORE_EXPERIENCE_CAPABILITY.PUBLISH,
  ),
  controller.publishCurrentStorefront,
);
router.post(
  '/unpublish',
  allowStoreExperienceCapabilities(
    STORE_EXPERIENCE_CAPABILITY.READ,
    STORE_EXPERIENCE_CAPABILITY.PUBLISH,
  ),
  controller.unpublishCurrentStorefront,
);

module.exports = router;
