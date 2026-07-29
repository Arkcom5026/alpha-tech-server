const { prisma } = require('../../../lib/prisma');
const loginService = require('./loginService');
const { parseRememberMe } = require('../shared/authNormalization');
const { buildAccessToken, ACCESS_TOKEN_EXPIRES } = require('../shared/tokenFactory');

const REFRESH_TOKEN_EXPIRES_DEFAULT = String(process.env.REFRESH_TOKEN_EXPIRES_DEFAULT || '1d');
const REFRESH_TOKEN_EXPIRES_REMEMBER_ME = String(process.env.REFRESH_TOKEN_EXPIRES_REMEMBER_ME || '30d');
const REFRESH_COOKIE_NAME = String(process.env.REFRESH_COOKIE_NAME || 'refreshToken');

const getRefreshTokenExpiresIn = (rememberMe = false) => (
  rememberMe ? REFRESH_TOKEN_EXPIRES_REMEMBER_ME : REFRESH_TOKEN_EXPIRES_DEFAULT
);

const getRefreshTokenExpiresAt = (rememberMe = false) => {
  const expiresIn = getRefreshTokenExpiresIn(rememberMe);
  if (/^[0-9]+d$/.test(expiresIn)) {
    return new Date(Date.now() + Number(expiresIn.replace('d', '')) * 24 * 60 * 60 * 1000);
  }
  if (/^[0-9]+h$/.test(expiresIn)) {
    return new Date(Date.now() + Number(expiresIn.replace('h', '')) * 60 * 60 * 1000);
  }
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
};

const createRawRefreshToken = () => require('crypto').randomBytes(48).toString('hex');
const sha256 = (value) => require('crypto').createHash('sha256').update(String(value || '')).digest('hex');

const createRefreshTokenRecord = async ({ userId, rememberMe = false, req }) => {
  const rawToken = createRawRefreshToken();
  const tokenHash = sha256(rawToken);
  const expiresAt = getRefreshTokenExpiresAt(rememberMe);

  const refreshToken = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: String(req?.headers?.['user-agent'] || '').trim() || null,
      ipAddress: String(req?.headers?.['x-forwarded-for'] || req?.ip || req?.socket?.remoteAddress || '')
        .split(',')[0]
        .trim() || null,
    },
  });

  return { rawToken, refreshToken };
};

const setRefreshTokenCookie = (res, refreshToken, rememberMe = false) => {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
  });
};

const login = async (req, res) => {
  try {
    const rememberMe = parseRememberMe(req.body?.rememberMe);
    const result = await loginService.authenticate({
      identifier: req.body?.emailOrPhone ?? req.body?.identifier,
      password: req.body?.password,
    });

    if (!result.ok) return res.status(result.status).json(result.body);

    const user = result.user;
    const profile = user.employeeProfile;
    const accessToken = buildAccessToken(user);
    const refreshTokenRecord = await createRefreshTokenRecord({ userId: user.id, rememberMe, req });
    setRefreshTokenCookie(res, refreshTokenRecord.rawToken, rememberMe);

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
    console.error('🔥 Login error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบเซิร์ฟเวอร์หลังบ้าน' });
  }
};

module.exports = { login };
