'use strict';

const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const controller = require('./storefrontMediaController');
const { uploadStorefrontMedia } = require('./storefrontMediaUpload');
const { allowStoreExperienceManage } = require('../shared/storeExperienceAuthorization');

const router = express.Router();

router.use(verifyToken, allowStoreExperienceManage);
router.get('/', controller.listStorefrontMedia);
router.post('/upload', (req, res) => {
  uploadStorefrontMedia.single('file')(req, res, (error) => {
    if (error) return controller.sendError(res, error);
    return controller.uploadStorefrontMedia(req, res);
  });
});

module.exports = router;
