const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const repository = require('./sessionAuthRuntimeRepository');
const legacyAuthController = require('../../../../../controllers/authController');

const ACCESS_TOKEN_EXPIRES = String(process.env.ACCESS_TOKEN_EXPIRES || '1h');
const REFRESH_TOKEN_EXPIRES_DEFAULT = String(process.env.REFRESH_TOKEN_EXPIRES_DEFAULT || '1d');
const REFRESH_TOKEN_EXPIRES_REMEMBER_ME = String(process.env.REFRESH_TOKEN_EXPIRES_REMEMBER_ME || '30d');
const REFRESH_COOKIE_NAME = String(process.env.REFRESH_COOKIE_NAME || 'refreshToken');

const normalize = (value) => (
  value === undefined || value === null ? '' : String(value).trim()
);
const normalizeEmail = (value) => normalize(value).toLowerCase();
const sha256 = (value) => crypto
  .createHash('sha256')
  .update(String(value || ''))
  .digest('hex');
const createRawRefreshToken = () => crypto.randomBytes(48).toString('hex');

const getRefreshTokenExpiresIn = (rememberMe = false) => (
  rememberMe ? REFRESH_TOKEN_EXPIRES_REMEMBER_ME : REFRESH_TOKEN_EXPIRES_DEFAULT
);

const getRefreshTokenExpiresAt = (rememberMe = false) => {
  const expiresIn = getRefreshTokenExpiresIn(rememberMe);
  if (/^[0-9]+d$/.test(expiresIn)) {
    return new Date(
      Date.now() + Number(expiresIn.replace('d', '')) * 24 * 60 * 60 * 1000
    );
  }
  if (/^[0-9]+h$/.test(expiresIn)) {
    return new Date(
      Date.now() + Number(expiresIn.replace('h', '')) * 60 * 60 * 1000
    );
  }
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
};

const getRefreshCookieOptions = (rememberMe = false) => ({
  httpOnly: true,
  secure: false,
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: rememberMe
    ? 7 * 24 * 60 * 60 * 1000
    : 24 * 60 * 60 * 1000,
});

const getRequestIpAddress = (req) => {
  const forwardedFor = normalize(req?.headers?.['x-forwarded-for']);
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return normalize(req?.ip || req?.socket?.remoteAddress || '');
};

const getRequestUserAgent = (req) => normalize(req?.headers?.['user-agent']);

const buildToken = (user) => {
  const profile = user.employeeProfile || null;
  return jwt.sign({
    id: user.id,
    role: user.role,
    profileType: 'employee',
    profileId: profile?.id || null,
    branchId: profile?.branchId || null,
    employeeId: profile?.id || null,
  }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
};

const setRefreshTokenCookie = (res, refreshToken, rememberMe = false) => {
  res.cookie(
    REFRESH_COOKIE_NAME,
    refreshToken,
    getRefreshCookieOptions(rememberMe)
  );
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  });
};

const createRefreshTokenRecord = async ({ userId, rememberMe = false, req, tx }) => {
  const rawToken = createRawRefreshToken();
  const tokenHash = sha256(rawToken);
  const expiresAt = getRefreshTokenExpiresAt(rememberMe);
  const refreshToken = await repository.createRefreshToken({
    userId,
    tokenHash,
    expiresAt,
    userAgent: getRequestUserAgent(req) || null,
    ipAddress: getRequestIpAddress(req) || null,
  }, tx);

  return { rawToken, tokenHash, expiresAt, rememberMe, refreshToken };
};

const revokeRefreshTokenFamilyChain = async ({ tokenId, tx, revokedAt = new Date() }) => {
  if (!tokenId) return;
  const visited = new Set();
  const queue = [tokenId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);
    const children = await repository.findRefreshTokenChildren(currentId, tx);
    queue.push(...children.map((item) => item.id));
  }

  if (visited.size > 0) {
    await repository.revokeRefreshTokensByIds({
      ids: Array.from(visited),
      revokedAt,
    }, tx);
  }
};

const resolveLegacyHandler = (key) => {
  const value = legacyAuthController?.[key];
  if (typeof value === 'function') return value;
  if (value && typeof value.handler === 'function') return value.handler;
  if (value && typeof value.handle === 'function') return value.handle;
  if (value && typeof value.fn === 'function') return value.fn;
  return null;
};

const requireLegacyHandler = (key) => {
  const handler = resolveLegacyHandler(key);
  if (typeof handler !== 'function') {
    throw new Error(`[sessionAuthRuntimeService] authController.${key} must resolve to a function`);
  }
  return handler;
};

const refreshSession = async (req, res) => {
  const trace = (stage, payload = {}) => {
    if (process.env.AUTH_TRACE === '1') console.log('[refreshSession]', stage, payload);
  };

  try {
    const rawRefreshToken = normalize(req.cookies?.[REFRESH_COOKIE_NAME]);
    if (!rawRefreshToken) {
      trace('MISSING_COOKIE');
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Refresh token is required' });
    }

    const tokenHash = sha256(rawRefreshToken);
    const existingToken = await repository.findRefreshTokenByHash(tokenHash);
    if (!existingToken) {
      trace('TOKEN_NOT_FOUND');
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const now = new Date();
    if (existingToken.revokedAt) {
      trace('TOKEN_REUSE', { tokenId: existingToken.id });
      await repository.runTransaction(async (tx) => {
        await revokeRefreshTokenFamilyChain({ tokenId: existingToken.id, tx, revokedAt: now });
      });
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Refresh token reuse detected' });
    }

    if (existingToken.expiresAt <= now) {
      trace('TOKEN_EXPIRED', { tokenId: existingToken.id });
      await repository.updateRefreshToken({
        id: existingToken.id,
        data: { revokedAt: now },
      });
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Refresh token expired' });
    }

    const user = existingToken.user;
    if (!user || !user.enabled || !user.employeeProfile) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Session expired or not allowed' });
    }

    if (user.employeeProfile.active === false || user.employeeProfile.approved === false) {
      clearRefreshTokenCookie(res);
      return res.status(403).json({ message: 'Session is no longer allowed' });
    }

    const rememberMe = (
      existingToken.expiresAt.getTime() - existingToken.createdAt.getTime()
      > 24 * 60 * 60 * 1000
    );

    const rotated = await repository.runTransaction(async (tx) => {
      const newTokenRecord = await createRefreshTokenRecord({
        userId: user.id,
        rememberMe,
        req,
        tx,
      });
      await repository.updateRefreshToken({
        id: existingToken.id,
        data: {
          revokedAt: now,
          replacedByTokenId: newTokenRecord.refreshToken.id,
        },
      }, tx);
      return newTokenRecord;
    });

    const profile = user.employeeProfile;
    const accessToken = buildToken(user);
    setRefreshTokenCookie(res, rotated.rawToken, rememberMe);

    return res.json({
      token: accessToken,
      accessToken,
      role: user.role,
      profileType: 'employee',
      profile: {
        id: profile.id,
        name: profile.name || '',
        phone: profile.phone || '',
        branch: profile.branch || null,
        position: profile.position || null,
        user: { id: user.id, email: user.email, role: user.role },
      },
      session: {
        rememberMe,
        accessTokenExpiresIn: ACCESS_TOKEN_EXPIRES,
        refreshTokenExpiresIn: getRefreshTokenExpiresIn(rememberMe),
      },
    });
  } catch (error) {
    clearRefreshTokenCookie(res);
    console.error('❌ refreshSession error:', error);
    return res.status(401).json({ message: 'Unable to refresh session' });
  }
};

const logoutSession = async (req, res) => {
  try {
    const rawRefreshToken = normalize(req.cookies?.[REFRESH_COOKIE_NAME]);
    if (rawRefreshToken) {
      await repository.revokeRefreshTokenByHash({
        tokenHash: sha256(rawRefreshToken),
        revokedAt: new Date(),
      });
    }
    clearRefreshTokenCookie(res);
    return res.json({ message: 'ออกจากระบบเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('❌ logoutSession error:', error);
    return res.status(500).json({ message: 'ไม่สามารถออกจากระบบได้' });
  }
};

const revokeSession = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ message: 'Unauthorized' });
    }

    await repository.revokeActiveRefreshTokensByUserId({
      userId,
      revokedAt: new Date(),
    });
    clearRefreshTokenCookie(res);
    return res.json({ message: 'ออกจากระบบทุกอุปกรณ์เรียบร้อยแล้ว' });
  } catch (error) {
    console.error('❌ revokeSession error:', error);
    return res.status(500).json({ message: 'ไม่สามารถออกจากระบบทุกอุปกรณ์ได้' });
  }
};

const getMe = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const user = await repository.findSessionUserById(userId);
    if (!user || !user.employeeProfile) {
      return res.status(404).json({ message: 'User or EmployeeProfile not found' });
    }

    const profile = user.employeeProfile;
    return res.json({
      role: user.role,
      profileType: 'employee',
      branchId: profile.branchId || null,
      profile: {
        id: profile.id || null,
        name: profile.name || '',
        phone: profile.phone || '',
        email: user.email || '',
        branch: profile.branch || null,
        position: profile.position || null,
        branchId: profile.branchId || null,
        user: { id: user.id, email: user.email, role: user.role },
      },
    });
  } catch (error) {
    console.error('❌ getMe error:', error);
    return res.status(500).json({ message: 'Failed to verify session' });
  }
};

const findUserByEmail = async (req, res) => {
  try {
    const email = normalizeEmail(req.query?.email);
    if (!email) return res.status(400).json({ message: 'กรุณาระบุอีเมล' });

    const user = await repository.findUserByEmail(email);
    if (!user) return res.status(404).json({ message: 'ไม่พบผู้ใช้อีเมลนี้' });

    return res.json({
      id: user.id,
      email: user.email,
      name: user.customerProfile?.name || '',
      phone: user.customerProfile?.phone || '',
      alreadyEmployee: Boolean(user.employeeProfile),
    });
  } catch (error) {
    console.error('❌ findUserByEmail error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

module.exports = {
  login: requireLegacyHandler('login'),
  register: requireLegacyHandler('register'),
  refreshSession,
  logoutSession,
  getMe,
  forgotPassword: requireLegacyHandler('forgotPassword'),
  resetPassword: requireLegacyHandler('resetPassword'),
  findUserByEmail,
  revokeSession,
};
