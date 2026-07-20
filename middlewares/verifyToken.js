// server/middlewares/verifyToken.js
// Runtime authentication evidence logging:
// - Does not log the raw JWT or JWT secret.
// - Uses a short SHA-256 fingerprint to correlate requests safely.
// - Does not change authentication or authorization behavior.

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const normalizeRole = (r) => {
  const v = (r || '').toString().trim().toLowerCase();

  // normalize common typos
  const fixed = v === 'supperadmin' ? 'superadmin' : v;

  // return CANONICAL UPPERCASE role to match controllers / Prisma enum
  if (fixed === 'superadmin') return 'SUPERADMIN';
  if (fixed === 'admin') return 'ADMIN';
  if (fixed === 'employee') return 'EMPLOYEE';
  if (fixed === 'customer') return 'CUSTOMER';

  return fixed.toUpperCase();
};

const normalizeProfileType = (t) => {
  // profileType may come as: "customer" | "employee" |
  // "customer,employee" | ["customer","employee"]
  // Priority: employee > customer
  if (Array.isArray(t)) {
    const arr = t
      .map((x) => (x || '').toString().trim().toLowerCase())
      .filter(Boolean);

    if (arr.includes('employee')) return 'employee';
    if (arr.includes('customer')) return 'customer';

    return arr[0] || null;
  }

  const v = (t || '').toString().trim().toLowerCase();
  if (!v) return null;

  // comma-separated or space-separated values
  const parts = v
    .split(/[\s,]+/)
    .map((x) => x.trim())
    .filter(Boolean);

  if (parts.includes('employee')) return 'employee';
  if (parts.includes('customer')) return 'customer';

  return parts[0] || null;
};

const deriveProfileTypeFromRole = (role, currentProfileType, decoded) => {
  const r = (role || '').toString().toLowerCase();
  const pt = normalizeProfileType(currentProfileType);

  // Priority rule (P1): If user can be both customer + employee,
  // always prefer employee context.

  // 1) Role group that implies employee context
  if (['employee', 'admin', 'superadmin'].includes(r)) return 'employee';

  // 2) If token/profileType indicates employee (even if role is messy)
  if (pt === 'employee') return 'employee';

  // 3) If employeeId exists in token, prefer employee
  if (decoded?.employeeId) return 'employee';

  // Customer
  if (r === 'customer') return 'customer';

  // fallback
  return pt || null;
};

const createTokenFingerprint = (token) => {
  try {
    if (!token) return null;

    return crypto
      .createHash('sha256')
      .update(String(token))
      .digest('hex')
      .slice(0, 12);
  } catch (_) {
    return null;
  }
};

const getRequestLogContext = (req) => ({
  reqId: req?.id || req?.headers?.['x-request-id'] || null,
  method: req?.method || null,
  path: req?.originalUrl || req?.url || null,
});

const verifyToken = (req, res, next) => {
  let tokenFingerprint = null;

  try {
    const requestContext = getRequestLogContext(req);
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !authHeader.toString().startsWith('Bearer ')) {
      console.warn('[verifyToken] MISSING_BEARER', requestContext);
      return res.status(401).json({ message: 'unauthorized' });
    }

    const token = authHeader.toString().slice('Bearer '.length).trim();

    if (!token) {
      console.warn('[verifyToken] EMPTY_TOKEN', requestContext);
      return res.status(401).json({ message: 'unauthorized' });
    }

    tokenFingerprint = createTokenFingerprint(token);

    console.log('[verifyToken] REQUEST', {
      ...requestContext,
      tokenFingerprint,
    });

    const secret = process.env.JWT_SECRET || process.env.SECRET_KEY;

    if (!secret) {
      console.error('[verifyToken] MISSING_SECRET', {
        ...requestContext,
        tokenFingerprint,
      });

      return res.status(500).json({ message: 'server_misconfigured' });
    }

    const decoded = jwt.verify(token, secret);

    console.log('[verifyToken] VERIFIED', {
      ...requestContext,
      tokenFingerprint,
      userId: decoded?.id ?? null,
      role: decoded?.role ?? null,
      profileType: decoded?.profileType ?? null,
      profileId: decoded?.profileId ?? null,
      employeeId: decoded?.employeeId ?? null,
      branchId: decoded?.branchId ?? null,
      issuedAt: decoded?.iat ?? null,
      expiresAt: decoded?.exp ?? null,
      expiresInSeconds:
        Number.isFinite(Number(decoded?.exp))
          ? Number(decoded.exp) - Math.floor(Date.now() / 1000)
          : null,
    });

    const role = normalizeRole(decoded?.role);
    const profileType = deriveProfileTypeFromRole(
      role,
      decoded?.profileType,
      decoded
    );

    // canonical req.user
    // NOTE: P1 allows a single User to be both Customer + Employee.
    // Therefore we must keep IDs explicit and also provide a canonical
    // activeProfileId based on the resolved context.
    const customerProfileId = decoded?.profileId ?? null;
    const employeeId = decoded?.employeeId ?? null;
    const activeProfileId =
      profileType === 'employee' ? employeeId : customerProfileId;

    req.user = {
      id: decoded?.id ?? null,
      role,
      profileType,

      // Canonical profile ID for the current context.
      profileId: activeProfileId,
      activeProfileId,

      // Explicit IDs.
      customerProfileId,
      employeeId,

      // Branch context.
      branchId: decoded?.branchId ?? null,
    };

    return next();
  } catch (err) {
    console.error('[verifyToken] FAILED', {
      ...getRequestLogContext(req),
      tokenFingerprint,
      errorName: err?.name || null,
      errorMessage: err?.message || null,
      expiredAt:
        err?.expiredAt instanceof Date
          ? err.expiredAt.toISOString()
          : err?.expiredAt || null,
      currentTime: new Date().toISOString(),
    });

    return res.status(401).json({ message: 'unauthorized' });
  }
};

module.exports = verifyToken;
