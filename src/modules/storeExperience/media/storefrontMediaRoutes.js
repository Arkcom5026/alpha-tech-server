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
const allowEmployeeContext = allowStoreExperienceCapabilities(STORE_EXPERIENCE_CAPABILITY.READ);
const allowManage = allowStoreExperienceCapabilities(
  STORE_EXPERIENCE_CAPABILITY.READ,
  STORE_EXPERIENCE_CAPABILITY.MANAGE,
);

router.use(verifyToken, allowEmployeeContext);
router.get('/', controller.listStorefrontMedia);
router.post('/upload', allowManage, (req, res) => {
  uploadStorefrontMedia.single('file')(req, res, (error) => {
    if (error) return controller.sendError(res, error);
    return controller.uploadStorefrontMedia(req, res);
  });
});

module.exports = router;
