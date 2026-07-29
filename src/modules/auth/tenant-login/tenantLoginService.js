const tenantLoginRepository = require('./tenantLoginRepository');
const { bcryptCompare } = require('../shared/passwordHasher');
const { buildAccessToken } = require('../shared/tokenFactory');

const login = async ({ email, password, tenantSlug }) => {
  const user = await tenantLoginRepository.findEmployeeIdentityByEmail(email);
  const profile = user?.employeeProfile || null;

  if (!user || !user.enabled || !profile || profile.active === false) {
    return { error: 'INVALID_ACCOUNT' };
  }

  if (!profile.branch || profile.branch.slug !== tenantSlug) {
    return { error: 'TENANT_FORBIDDEN' };
  }

  const isPasswordCorrect = await bcryptCompare(password, user.password);
  if (!isPasswordCorrect) return { error: 'INVALID_PASSWORD' };

  const token = buildAccessToken(user, {
    tenantSlug: profile.branch.slug,
  });

  return {
    token,
    employee: {
      id: profile.id,
      email: user.email,
      firstName: profile.name || '',
      lastName: '',
      role: profile.v2Role || user.role,
      branch: {
        id: profile.branch.id,
        name: profile.branch.name,
      },
    },
  };
};

module.exports = { login };
