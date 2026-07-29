const crypto = require('crypto');

const REFRESH_TOKEN_EXPIRES_DEFAULT = String(process.env.REFRESH_TOKEN_EXPIRES_DEFAULT || '1d');
const REFRESH_TOKEN_EXPIRES_REMEMBER_ME = String(process.env.REFRESH_TOKEN_EXPIRES_REMEMBER_ME || '30d');
const REFRESH_COOKIE_NAME = String(process.env.REFRESH_COOKIE_NAME || 'refreshToken');

const sha256 = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const createRawRefreshToken = () => crypto.randomBytes(48).toString('hex');

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

const getRequestIpAddress = (req) => {
  const forwardedFor = String(req?.headers?.['x-forwarded-for'] || '').trim();
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return String(req?.ip || req?.socket?.remoteAddress || '').trim();
};

const getRequestUserAgent = (req) => String(req?.headers?.['user-agent'] || '').trim();

const buildRefreshTokenRecord = ({ userId, rememberMe, req }) => {
  const rawToken = createRawRefreshToken();
  return {
    rawToken,
    tokenHash: sha256(rawToken),
    expiresAt: getRefreshTokenExpiresAt(rememberMe),
    userId,
    userAgent: getRequestUserAgent(req),
    ipAddress: getRequestIpAddress(req),
  };
};

const setRefreshTokenCookie = (res, refreshToken, rememberMe = false) => {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: rememberMe
      ? 7 * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000,
  });
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  });
};

module.exports = {
  REFRESH_COOKIE_NAME,
  sha256,
  getRefreshTokenExpiresIn,
  buildRefreshTokenRecord,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
};
