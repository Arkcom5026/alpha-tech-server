const sessionRepository = require('./sessionRepository');
const {
  sha256,
  getRefreshTokenExpiresIn,
  buildRefreshTokenRecord,
} = require('./sessionTokenService');
const { buildAccessToken, ACCESS_TOKEN_EXPIRES } = require('../shared/tokenFactory');

const revokeRefreshTokenFamilyChain = async (tokenId) => {
  if (!tokenId) return;

  const visited = new Set();
  const queue = [tokenId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);

    const children = await sessionRepository.findChildTokenIds(currentId);
    queue.push(...children.map((item) => item.id));
  }

  if (visited.size > 0) {
    await sessionRepository.revokeTokenIds(Array.from(visited));
  }
};

const refresh = async ({ rawRefreshToken, req }) => {
  if (!rawRefreshToken) {
    return { failure: { status: 401, message: 'Refresh token not found' } };
  }

  const existingToken = await sessionRepository.findRefreshTokenByHash(sha256(rawRefreshToken));
  if (!existingToken) {
    return { clearCookie: true, failure: { status: 401, message: 'Invalid refresh token' } };
  }

  if (existingToken.revokedAt) {
    await revokeRefreshTokenFamilyChain(existingToken.id);
    return {
      clearCookie: true,
      failure: { status: 401, message: 'Refresh token reuse detected. Please log in again.' },
    };
  }

  if (existingToken.expiresAt <= new Date()) {
    return { clearCookie: true, failure: { status: 401, message: 'Session expired' } };
  }

  const user = existingToken.user;
  if (!user || !user.enabled || !user.employeeProfile) {
    return { clearCookie: true, failure: { status: 401, message: 'Session expired or not allowed' } };
  }

  if (user.employeeProfile.active === false || user.employeeProfile.approved === false) {
    return { clearCookie: true, failure: { status: 403, message: 'Session is no longer allowed' } };
  }

  const rememberMe = existingToken.expiresAt.getTime() - existingToken.createdAt.getTime()
    > 24 * 60 * 60 * 1000;
  const newToken = buildRefreshTokenRecord({ userId: user.id, rememberMe, req });
  const refreshToken = await sessionRepository.rotateRefreshToken({
    existingTokenId: existingToken.id,
    ...newToken,
  });

  const profile = user.employeeProfile;
  const accessToken = buildAccessToken(user);

  return {
    rawRefreshToken: newToken.rawToken,
    refreshToken,
    rememberMe,
    response: {
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
    },
  };
};

const logout = async (rawRefreshToken) => {
  if (rawRefreshToken) {
    await sessionRepository.revokeByTokenHash(sha256(rawRefreshToken));
  }
};

const logoutAll = async (userId) => {
  if (!userId) return false;
  await sessionRepository.revokeAllByUserId(userId);
  return true;
};

module.exports = {
  refresh,
  logout,
  logoutAll,
};
