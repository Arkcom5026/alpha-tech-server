'use strict';

const {
  RESIDUAL_BUSINESS_CAPABILITIES,
  hasResidualBusinessCapability,
} = require('../../employee/authorization/residualBusinessPositionAuthority');

const PARTNER_STORE_CAPABILITY = Object.freeze({
  READ: RESIDUAL_BUSINESS_CAPABILITIES.STORE_EXPERIENCE_READ,
  MANAGE: RESIDUAL_BUSINESS_CAPABILITIES.STORE_EXPERIENCE_MANAGE,
});

const normalizeUpper = (value) => String(value || '').trim().toUpperCase();

const requirePartnerStoreEmployeeContext = (req, res, next) => {
  const role = normalizeUpper(req?.user?.role);
  const nestedRole = normalizeUpper(req?.employee?.role);
  const profileType = String(req?.user?.profileType || '').trim().toLowerCase();
  const authorized =
    ['EMPLOYEE', 'ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(role)
    || ['EMPLOYEE', 'ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(nestedRole)
    || profileType === 'employee';

  if (authorized) return next();
  return res.status(403).json({
    success: false,
    code: 'FORBIDDEN_PARTNER_STORE_ACCESS',
    message: 'ไม่มีสิทธิ์จัดการการตั้งค่าร้าน',
  });
};

const allowPartnerStoreCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const missing = requiredCapabilities.filter(
    (capability) => !hasResidualBusinessCapability(req.user || {}, capability),
  );

  if (missing.length === 0) return next();
  return res.status(403).json({
    success: false,
    code: 'FORBIDDEN_PARTNER_STORE_ACCESS',
    message: 'ตำแหน่งของบัญชีนี้ไม่มีสิทธิ์จัดการการตั้งค่าร้าน',
    details: { requiredCapabilities },
  });
};

module.exports = {
  PARTNER_STORE_CAPABILITY,
  requirePartnerStoreEmployeeContext,
  allowPartnerStoreCapabilities,
};
