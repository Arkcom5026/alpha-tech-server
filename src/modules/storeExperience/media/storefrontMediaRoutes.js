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

const allowRead = allowStoreExperienceCapabilities(STORE_EXPERIENCE_CAPABILITY.READ);
const allowMediaManage = allowStoreExperienceCapabilities(
  STORE_EXPERIENCE_CAPABILITY.READ,
  STORE_EXPERIENCE_CAPABILITY.MANAGE,
  STORE_EXPERIENCE_CAPABILITY.MEDIA,
);

router.use(verifyToken);
router.get('/', allowRead, controller.listStorefrontMedia);
router.post('/upload', allowMediaManage, (req, res) => {
  uploadStorefrontMedia.single('file')(req, res, (error) => {
    if (error) return controller.sendError(res, error);
    return controller.uploadStorefrontMedia(req, res);
  });
});

module.exports = router;
