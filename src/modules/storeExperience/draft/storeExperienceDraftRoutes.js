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
const roleOf = (value) => String(value || '').trim().toUpperCase();
const allowEmployeeContext = (req, res, next) => {
  const role = roleOf(req?.user?.role);
  const employeeRole = roleOf(req?.employee?.role);
  const employeeProfile = String(req?.user?.profileType || '').trim().toLowerCase() === 'employee';
  if (employeeProfile || ['EMPLOYEE', 'ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(role) || ['EMPLOYEE', 'ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(employeeRole)) return next();
  return res.status(403).json({ success: false, code: 'FORBIDDEN_STORE_EXPERIENCE_ACCESS', message: 'ไม่มีสิทธิ์จัดการหน้าร้าน' });
};

const canManage = allowStoreExperienceCapabilities(STORE_EXPERIENCE_CAPABILITY.MANAGE);
const canPublish = allowStoreExperienceCapabilities(
  STORE_EXPERIENCE_CAPABILITY.MANAGE,
  STORE_EXPERIENCE_CAPABILITY.PUBLISH,
);

router.use('/media', storefrontMediaRoutes);
router.use(verifyToken, allowEmployeeContext);
router.get('/draft', canManage, controller.getCurrentDraft);
router.put('/draft', canManage, controller.saveCurrentDraft);
router.post('/publish', canPublish, controller.publishCurrentStorefront);
router.post('/unpublish', canPublish, controller.unpublishCurrentStorefront);

module.exports = router;
