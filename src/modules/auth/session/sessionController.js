const sessionService = require('./sessionService');
const {
  REFRESH_COOKIE_NAME,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} = require('./sessionTokenService');

const normalize = (value) => (value === undefined || value === null ? '' : String(value).trim());

const refreshSession = async (req, res) => {
  const traceId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const trace = (message, data = {}) => {
    console.log(
      `[AUTH-TRACE-BE] [${new Date().toISOString().slice(11, 23)}] [REFRESH:${traceId}] ${message}`,
      JSON.stringify(data),
    );
  };

  try {
    const rawRefreshToken = normalize(req.cookies?.[REFRESH_COOKIE_NAME]);
    trace('START', { hasCookie: Boolean(rawRefreshToken) });

    const result = await sessionService.refresh({ rawRefreshToken, req });

    if (result.clearCookie) clearRefreshTokenCookie(res);
    if (result.failure) {
      trace('REFUSED', { status: result.failure.status, message: result.failure.message });
      return res.status(result.failure.status).json({ message: result.failure.message });
    }

    setRefreshTokenCookie(res, result.rawRefreshToken, result.rememberMe);
    trace('SUCCESS', { userId: result.response?.profile?.user?.id });
    return res.json(result.response);
  } catch (error) {
    trace('ERROR', { message: error.message });
    clearRefreshTokenCookie(res);
    console.error('❌ refreshSession error:', error);
    return res.status(401).json({ message: 'Unable to refresh session' });
  }
};

const logoutSession = async (req, res) => {
  try {
    const rawRefreshToken = normalize(req.cookies?.[REFRESH_COOKIE_NAME]);
    await sessionService.logout(rawRefreshToken);
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

    await sessionService.logoutAll(userId);
    clearRefreshTokenCookie(res);
    return res.json({ message: 'ออกจากระบบทุกอุปกรณ์เรียบร้อยแล้ว' });
  } catch (error) {
    console.error('❌ revokeSession error:', error);
    return res.status(500).json({ message: 'ไม่สามารถออกจากระบบทุกอุปกรณ์ได้' });
  }
};

module.exports = {
  refreshSession,
  logoutSession,
  revokeSession,
};
