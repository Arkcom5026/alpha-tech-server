'use strict';

const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const controller = require('./storefrontMediaController');
const { uploadStorefrontMedia } = require('./storefrontMediaUpload');

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

router.use(verifyToken, allowEmployeeContext);
router.get('/', controller.listStorefrontMedia);
router.post('/upload', (req, res) => {
  uploadStorefrontMedia.single('file')(req, res, (error) => {
    if (error) return controller.sendError(res, error);
    return controller.uploadStorefrontMedia(req, res);
  });
});

module.exports = router;
