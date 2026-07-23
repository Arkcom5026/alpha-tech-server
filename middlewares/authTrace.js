// middlewares/authTrace.js
// ⚠️ TEMPORARY RUNTIME TRACING — Remove after investigation
// No business logic changes. Only adds console.log tracing.

const crypto = require('crypto');
const TRACE_PREFIX = '[AUTH-TRACE-BE]';

const now = () => new Date().toISOString().slice(11, 23);

const getFingerprint = (token) => {
  if (!token) return 'NULL';
  try {
    return crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 12).toUpperCase();
  } catch {
    return 'PRESENT';
  }
};

const trace = (category, ...args) => {
  console.log(`${TRACE_PREFIX} [${now()}] [${category}]`, ...args);
};

// Middleware to trace all incoming requests
const traceRequest = (req, res, next) => {
  const authHeader = req.headers?.authorization || '';
  const hasBearer = authHeader.startsWith('Bearer ');
  const token = hasBearer ? authHeader.slice(7) : null;
  const cookie = req.headers?.cookie || '';

  trace('REQUEST',
    `${req.method}`,
    `${req.originalUrl || req.url}`,
    `Bearer=${hasBearer ? 'YES' : 'NO'}`,
    `token=${getFingerprint(token)}`,
    `hasCookie=${cookie.includes('refreshToken') ? 'YES' : 'NO'}`
  );

  // Store start time for response tracing
  req._traceStartTime = Date.now();

  // Intercept res.end to trace response
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - (req._traceStartTime || Date.now());
    trace('RESPONSE',
      `${res.statusCode}`,
      `${req.method}`,
      `${req.originalUrl || req.url}`,
      `${duration}ms`
    );
    return originalEnd.apply(this, args);
  };

  next();
};

// Trace auth/refresh endpoint specifically
const traceRefreshRequest = (req, res, next) => {
  const cookie = req.headers?.cookie || '';
  const refreshTokenCookie = cookie.split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('refreshToken='));

  trace('REFRESH',
    'INCOMING',
    `refreshCookie=${refreshTokenCookie ? 'PRESENT' : 'MISSING'}`
  );

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const setCookieHeader = res.getHeaders()['set-cookie'] || '';
    const hasSetCookie = !!(setCookieHeader && (Array.isArray(setCookieHeader) ? setCookieHeader.length > 0 : String(setCookieHeader).length > 0));
    trace('REFRESH',
      'RESPONSE',
      `status=${res.statusCode}`,
      `hasBody=${body ? 'YES' : 'NO'}`,
      `hasSetCookie=${hasSetCookie ? 'YES' : 'NO'}`
    );
    return originalJson(body);
  };

  next();
};

// Trace verifyToken middleware
const traceVerifyToken = (req, res, next) => {
  const authHeader = req.headers?.authorization || '';
  const hasBearer = authHeader.startsWith('Bearer ');
  const token = hasBearer ? authHeader.slice(7) : null;

  trace('VERIFY_TOKEN',
    `url=${req.originalUrl || req.url}`,
    `Bearer=${hasBearer ? 'YES' : 'NO'}`,
    `token=${getFingerprint(token)}`
  );

  next();
};

// Trace auth controller actions
const traceAuthAction = (actionName) => (req, res, next) => {
  trace('AUTH_ACTION', actionName,
    `url=${req.originalUrl || req.url}`,
    `method=${req.method}`
  );
  next();
};

module.exports = {
  traceRequest,
  traceRefreshRequest,
  traceVerifyToken,
  traceAuthAction,
};
