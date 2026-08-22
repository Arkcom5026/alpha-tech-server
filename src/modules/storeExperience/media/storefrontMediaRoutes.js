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
const roleOf = (value) => String(value || '').trim().toUpperCase();

const allowEmployeeContext = (req, res, next) => {
  const role = roleOf(req?.user?.role);
  const employeeRole = roleOf(req?.employee?.role);
  const employeeProfile = String(req?.user?.profileType || '').trim().toLowerCase() === 'employee';
  if (employeeProfile || ['EMPLOYEE', 'ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(role) || ['EMPLOYEE', 'ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(employeeRole)) {
    return next();
  }
  return res.status(403).json({
    success: false,
    code: 'FORBIDDEN_STORE_EXPERIENCE_ACCESS',
    message: 'ไม่มีสิทธิ์จัดการหน้าร้าน',
  });
};

const canManage = allowStoreExperienceCapabilities(STORE_EXPERIENCE_CAPABILITY.MANAGE);

router.use(verifyToken, allowEmployeeContext);
router.get('/', canManage, controller.listStorefrontMedia);
router.post('/upload', canManage, (req, res) => {
  uploadStorefrontMedia.single('file')(req, res, (error) => {
    if (error) return controller.sendError(res, error);
    return controller.uploadStorefrontMedia(req, res);
  });
});

module.exports = router;
