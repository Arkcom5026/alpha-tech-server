const crypto = require('crypto');

const PASSWORD_RESET_TOKEN_EXPIRES_MINUTES = Number(
  process.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES || 30,
);

const sha256 = (value) => crypto
  .createHash('sha256')
  .update(String(value || ''))
  .digest('hex');

const createPasswordResetToken = () => crypto.randomBytes(32).toString('hex');

const getPasswordResetExpiresAt = () => new Date(
  Date.now() + PASSWORD_RESET_TOKEN_EXPIRES_MINUTES * 60 * 1000,
);

const getAppBaseUrl = (req) => {
  const envBaseUrl = String(process.env.APP_BASE_URL || process.env.CLIENT_URL || '').trim();
  if (envBaseUrl) return envBaseUrl;

  const originHeader = String(req?.headers?.origin || '').trim();
  if (originHeader) return originHeader;

  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '').trim();
  const forwardedHost = String(req?.headers?.['x-forwarded-host'] || '').trim();
  if (forwardedProto && forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  const protocol = String(req?.protocol || '').trim();
  const host = String(req?.get?.('host') || '').trim();
  if (protocol && host) return `${protocol}://${host}`;

  return '';
};

const buildPasswordResetUrl = (req, rawToken) => {
  const appBaseUrl = getAppBaseUrl(req);
  if (!appBaseUrl) return '';
  const base = appBaseUrl.endsWith('/') ? appBaseUrl.slice(0, -1) : appBaseUrl;
  return `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;
};

module.exports = {
  PASSWORD_RESET_TOKEN_EXPIRES_MINUTES,
  sha256,
  createPasswordResetToken,
  getPasswordResetExpiresAt,
  buildPasswordResetUrl,
};