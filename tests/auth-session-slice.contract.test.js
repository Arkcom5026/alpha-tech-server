const fs = require('fs');
const path = require('path');

describe('auth session lifecycle slice', () => {
  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

  const routes = read('src/modules/auth/routes/authRoutes.js');
  const controller = read('src/modules/auth/session/sessionController.js');
  const service = read('src/modules/auth/session/sessionService.js');
  const repository = read('src/modules/auth/session/sessionRepository.js');
  const tokenService = read('src/modules/auth/session/sessionTokenService.js');

  test('canonical routes delegate the complete session lifecycle to the session slice', () => {
    expect(routes).toContain("require('../session/sessionController')");
    expect(routes).toContain("router.post('/refresh', traceRefreshRequest, sessionController.refreshSession)");
    expect(routes).toContain("router.post('/logout', sessionController.logoutSession)");
    expect(routes).toContain("router.post('/logout-all', verifyToken, sessionController.revokeSession)");
    expect(routes).not.toContain("ensureLegacyFn('refreshSession')");
    expect(routes).not.toContain("ensureLegacyFn('logoutSession')");
    expect(routes).not.toContain("resolveLegacyHandler('revokeSession')");
  });

  test('refresh controller preserves public failure and success behavior', () => {
    expect(controller).toContain("message: 'Unable to refresh session'");
    expect(controller).toContain('setRefreshTokenCookie(res, result.rawRefreshToken, result.rememberMe)');
    expect(controller).toContain('clearRefreshTokenCookie(res)');
    expect(controller).toContain("console.log(");
  });

  test('session service preserves refresh-token security policies', () => {
    expect(service).toContain("message: 'Refresh token not found'");
    expect(service).toContain("message: 'Invalid refresh token'");
    expect(service).toContain("message: 'Refresh token reuse detected. Please log in again.'");
    expect(service).toContain("message: 'Session expired'");
    expect(service).toContain("message: 'Session is no longer allowed'");
    expect(service).toContain('revokeRefreshTokenFamilyChain');
    expect(service).toContain('rotateRefreshToken');
    expect(service).toContain('buildAccessToken(user)');
  });

  test('repository owns Prisma persistence and atomic rotation', () => {
    expect(repository).toContain("require('../../../lib/prisma')");
    expect(repository).toContain('prisma.$transaction');
    expect(repository).toContain('replacedByTokenId: refreshToken.id');
    expect(repository).toContain('revokeByTokenHash');
    expect(repository).toContain('revokeAllByUserId');
  });

  test('token utility preserves hashing, expiry and cookie contract', () => {
    expect(tokenService).toContain("crypto.createHash('sha256')");
    expect(tokenService).toContain("crypto.randomBytes(48).toString('hex')");
    expect(tokenService).toContain("path: '/api/auth'");
    expect(tokenService).toContain('httpOnly: true');
    expect(tokenService).toContain('7 * 24 * 60 * 60 * 1000');
    expect(tokenService).toContain('24 * 60 * 60 * 1000');
  });
});
