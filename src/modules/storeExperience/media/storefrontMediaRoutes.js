'use strict';

const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const controller = require('./storefrontMediaController');
const { uploadStorefrontMedia } = require('./storefrontMediaUpload');
const {
  STORE_EXPERIENCE_CAPABILITY,
  allowStoreExperienceCapabilities,
} = require('../shared/storeExperienceAuthorization');

const router = express.Router();

router.use(verifyToken);
router.get(
  '/',
  allowStoreExperienceCapabilities(STORE_EXPERIENCE_CAPABILITY.READ),
  controller.listStorefrontMedia,
);
router.post(
  '/upload',
  allowStoreExperienceCapabilities(
    STORE_EXPERIENCE_CAPABILITY.READ,
    STORE_EXPERIENCE_CAPABILITY.MEDIA,
  ),
  (req, res) => {
    uploadStorefrontMedia.single('file')(req, res, (error) => {
      if (error) return controller.sendError(res, error);
      return controller.uploadStorefrontMedia(req, res);
    });
  },
);

module.exports = router;
