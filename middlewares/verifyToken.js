// server/middlewares/verifyToken.js
// JWT proves token authenticity; current User/Employee state remains database authority.

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { prisma } = require('../lib/prisma');

const normalizeRole = (role) => {
  const value = String(role || '').trim().toLowerCase();
  const fixed = value === 'supperadmin' ? 'superadmin' : value;

  if (fixed === 'superadmin') return 'SUPERADMIN';
  if (fixed === 'admin') return 'ADMIN';
  if (fixed === 'employee') return 'EMPLOYEE';
  if (fixed === 'customer') return 'CUSTOMER';
  return fixed.toUpperCase();
};

const normalizeProfileType = (profileType) => {
  const values = Array.isArray(profileType)
    ? profileType
    : String(profileType || '').split(/[\s,]+/);

  const normalized = values
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);

  if (normalized.includes('employee')) return 'employee';
  if (normalized.includes('customer')) return 'customer';
  return normalized[0] || null;
};

const deriveProfileType = ({ role, tokenProfileType, employeeProfile }) => {
  const roleLower = String(role || '').toLowerCase();
  if (employeeProfile || ['employee', 'admin', 'superadmin'].includes(roleLower)) return 'employee';
  return normalizeProfileType(tokenProfileType) || (roleLower === 'customer' ? 'customer' : null);
};

const createTokenFingerprint = (token) => {
  try {
    return token
      ? crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 12)
      : null;
  } catch (_) {
    return null;
  }
};

const getRequestLogContext = (req) => ({
  reqId: req?.id || req?.headers?.['x-request-id'] || null,
  method: req?.method || null,
  path: req?.originalUrl || req?.url || null,
});

const rejectLifecycle = (res, status, code, message) => (
  res.status(status).json({ code, message })
);

const verifyToken = async (req, res, next) => {
  let tokenFingerprint = null;

  try {
    const requestContext = getRequestLogContext(req);
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !String(authHeader).startsWith('Bearer ')) {
      console.warn('[verifyToken] MISSING_BEARER', requestContext);
      return res.status(401).json({ message: 'unauthorized' });
    }

    const token = String(authHeader).slice('Bearer '.length).trim();
    if (!token) return res.status(401).json({ message: 'unauthorized' });

    tokenFingerprint = createTokenFingerprint(token);
    const secret = process.env.JWT_SECRET || process.env.SECRET_KEY;
    if (!secret) {
      console.error('[verifyToken] MISSING_SECRET', { ...requestContext, tokenFingerprint });
      return res.status(500).json({ message: 'server_misconfigured' });
    }

    const decoded = jwt.verify(token, secret);
    const userId = Number(decoded?.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ message: 'unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        enabled: true,
        employeeProfile: {
          select: {
            id: true,
            branchId: true,
            positionId: true,
            approved: true,
            active: true,
            v2Role: true,
            position: {
              select: {
                id: true,
                capabilities: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return rejectLifecycle(res, 401, 'AUTH_USER_NOT_FOUND', 'บัญชีผู้ใช้ไม่พบในระบบ');
    }

    if (!user.enabled) {
      return rejectLifecycle(res, 403, 'USER_DISABLED', 'บัญชีนี้ถูกปิดใช้งาน');
    }

    const role = normalizeRole(user.role);
    const employeeProfile = user.employeeProfile || null;
    const profileType = deriveProfileType({
      role,
      tokenProfileType: decoded?.profileType,
      employeeProfile,
    });

    if (profileType === 'employee') {
      if (!employeeProfile) {
        return rejectLifecycle(res, 403, 'EMPLOYEE_PROFILE_REQUIRED', 'บัญชีนี้ไม่มีโปรไฟล์พนักงาน');
      }
      if (!employeeProfile.approved) {
        return rejectLifecycle(res, 403, 'EMPLOYEE_NOT_APPROVED', 'โปรไฟล์พนักงานยังไม่ได้รับการอนุมัติ');
      }
      if (!employeeProfile.active) {
        return rejectLifecycle(res, 403, 'EMPLOYEE_INACTIVE', 'โปรไฟล์พนักงานถูกระงับการใช้งาน');
      }
    }

    const employeeId = employeeProfile?.id || null;
    const positionCapabilities = Array.isArray(employeeProfile?.position?.capabilities)
      ? employeeProfile.position.capabilities
      : null;
    const customerProfileId = decoded?.customerProfileId ?? (
      profileType === 'customer' ? decoded?.profileId ?? null : null
    );
    const activeProfileId = profileType === 'employee' ? employeeId : customerProfileId;

    req.user = {
      id: user.id,
      role,
      profileType,
      profileId: activeProfileId,
      activeProfileId,
      customerProfileId,
      employeeId,
      branchId: employeeProfile?.branchId || null,
      positionId: employeeProfile?.positionId || null,
      positionCapabilities: positionCapabilities,
      positionAuthorityMode: positionCapabilities === null ? 'V2_ROLE_COMPAT' : 'POSITION',
      employeeApproved: employeeProfile?.approved ?? null,
      employeeActive: employeeProfile?.active ?? null,
      employeeRole: employeeProfile?.v2Role || null,
      isSuperAdmin: role === 'SUPERADMIN',
    };

    console.log('[verifyToken] VERIFIED', {
      ...requestContext,
      tokenFingerprint,
      userId: user.id,
      role,
      profileType,
      employeeId,
      branchId: req.user.branchId,
      positionId: req.user.positionId,
      positionAuthorityMode: req.user.positionAuthorityMode,
    });

    return next();
  } catch (error) {
    console.error('[verifyToken] FAILED', {
      ...getRequestLogContext(req),
      tokenFingerprint,
      errorName: error?.name || null,
      errorMessage: error?.message || null,
    });
    return res.status(401).json({ message: 'unauthorized' });
  }
};

module.exports = verifyToken;
