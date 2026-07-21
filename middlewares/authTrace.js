// middlewares/authTrace.js
// ⚠️ TEMPORARY RUNTIME TRACING — Remove after investigation
// No business logic changes. Only adds console.log tracing.

const TRACE_PREFIX = '[AUTH-TRACE-BE]';

const now = () => new Date().toISOString().slice(11, 23);

const getFingerprint = (token) => {
  if (!token) return 'NULL';
  try {
    let hash = 0;
    for (let i = 0; i < Math.min(token.length, 50); i++) {
      const chr = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).slice(0, 8).toUpperCase().padStart(8, '0');
  } catch {
    return token.slice(0, 8).toUpperCase();
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
    `refreshCookie=${refreshTokenCookie ? 'PRESENT' : 'MISSING'}`,
    `cookie=${cookie.slice(0, 100)}`
  );

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const setCookieHeader = res.getHeaders()['set-cookie'] || '';
    trace('REFRESH',
      'RESPONSE',
      `status=${res.statusCode}`,
      `body=${JSON.stringify(body).slice(0, 200)}`,
      `setCookie=${Array.isArray(setCookieHeader) ? setCookieHeader.join('; ').slice(0, 100) : String(setCookieHeader || '').slice(0, 100)}`
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
