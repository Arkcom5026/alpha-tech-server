// middlewares/authTrace.js
// Verbose authentication tracing is diagnostics-only and must be explicitly enabled.

const crypto = require('crypto');
const TRACE_PREFIX = '[AUTH-TRACE-BE]';

const now = () => new Date().toISOString().slice(11, 23);
const traceEnabled = () => process.env.AUTH_TRACE_ENABLED === 'true';

const getFingerprint = (token) => {
  if (!token) return 'NULL';
  try {
    return crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 12).toUpperCase();
  } catch {
    return 'PRESENT';
  }
};

const trace = (category, ...args) => {
  if (!traceEnabled()) return;
  console.log(`${TRACE_PREFIX} [${now()}] [${category}]`, ...args);
};

const traceRequest = (req, res, next) => {
  if (!traceEnabled()) return next();

  const authHeader = req.headers?.authorization || '';
  const hasBearer = authHeader.startsWith('Bearer ');
  const token = hasBearer ? authHeader.slice(7) : null;
  const cookie = req.headers?.cookie || '';

  trace(
    'REQUEST',
    `reqId=${req.id || 'UNKNOWN'}`,
    `${req.method}`,
    `${req.originalUrl || req.url}`,
    `Bearer=${hasBearer ? 'YES' : 'NO'}`,
    `token=${getFingerprint(token)}`,
    `hasCookie=${cookie.includes('refreshToken') ? 'YES' : 'NO'}`
  );

  req._traceStartTime = Date.now();

  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - (req._traceStartTime || Date.now());
    trace(
      'RESPONSE',
      `reqId=${req.id || 'UNKNOWN'}`,
      `${res.statusCode}`,
      `${req.method}`,
      `${req.originalUrl || req.url}`,
      `${duration}ms`
    );
    return originalEnd.apply(this, args);
  };

  return next();
};

const traceRefreshRequest = (req, res, next) => {
  if (!traceEnabled()) return next();

  const cookie = req.headers?.cookie || '';
  const refreshTokenCookie = cookie
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith('refreshToken='));

  trace(
    'REFRESH',
    `reqId=${req.id || 'UNKNOWN'}`,
    'INCOMING',
    `refreshCookie=${refreshTokenCookie ? 'PRESENT' : 'MISSING'}`
  );

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const setCookieHeader = res.getHeaders()['set-cookie'] || '';
    const hasSetCookie = Boolean(
      setCookieHeader && (Array.isArray(setCookieHeader) ? setCookieHeader.length > 0 : String(setCookieHeader).length > 0)
    );
    trace(
      'REFRESH',
      `reqId=${req.id || 'UNKNOWN'}`,
      'RESPONSE',
      `status=${res.statusCode}`,
      `hasBody=${body ? 'YES' : 'NO'}`,
      `hasSetCookie=${hasSetCookie ? 'YES' : 'NO'}`
    );
    return originalJson(body);
  };

  return next();
};

const traceVerifyToken = (req, res, next) => {
  if (!traceEnabled()) return next();

  const authHeader = req.headers?.authorization || '';
  const hasBearer = authHeader.startsWith('Bearer ');
  const token = hasBearer ? authHeader.slice(7) : null;

  trace(
    'VERIFY_TOKEN',
    `reqId=${req.id || 'UNKNOWN'}`,
    `url=${req.originalUrl || req.url}`,
    `Bearer=${hasBearer ? 'YES' : 'NO'}`,
    `token=${getFingerprint(token)}`
  );

  return next();
};

const traceAuthAction = (actionName) => (req, res, next) => {
  if (!traceEnabled()) return next();
  trace(
    'AUTH_ACTION',
    `reqId=${req.id || 'UNKNOWN'}`,
    actionName,
    `url=${req.originalUrl || req.url}`,
    `method=${req.method}`
  );
  return next();
};

module.exports = {
  traceRequest,
  traceRefreshRequest,
  traceVerifyToken,
  traceAuthAction,
};
