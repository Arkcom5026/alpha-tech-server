const { performance } = require('node:perf_hooks');

const { prisma } = require('../../../../../lib/prisma');

const authPerfEnabled = () => process.env.AUTH_PERF_TRACE === '1';
const measureAuthRepository = async (label, work) => {
  const startedAt = performance.now();
  try {
    return await work();
  } finally {
    if (authPerfEnabled()) {
      console.log(`[auth-perf] ${label} ${(performance.now() - startedAt).toFixed(1)}ms`);
    }
  }
};

const includeSessionProfiles = {
  customerProfiles: true,
  employeeProfile: {
    include: {
      branch: true,
      position: true,
    },
  },
};

const findUserByEmail = (email) => prisma.user.findUnique({
  where: { email },
  include: {
    customerProfiles: true,
    employeeProfile: true,
  },
});

const findLoginUserByEmail = (email) => prisma.user.findUnique({
  where: { email },
  include: includeSessionProfiles,
});

const findLoginUserByLoginId = (loginId) => prisma.user.findFirst({
  where: { loginId },
  include: includeSessionProfiles,
});

const findEmployeeUserIdByPhone = (phone) => prisma.employeeProfile.findFirst({
  where: { phone },
  select: { userId: true },
});

const findLoginUserById = (id) => prisma.user.findUnique({
  where: { id },
  include: includeSessionProfiles,
});

const findPasswordResetEligibleUserByEmail = (email) => prisma.user.findUnique({
  where: { email },
  select: {
    id: true,
    email: true,
    enabled: true,
  },
});

const findSessionUserById = (id) => measureAuthRepository(
  'session-user.lookup',
  () => prisma.user.findUnique({
    where: { id },
    include: {
      employeeProfile: {
        include: {
          branch: true,
          position: true,
        },
      },
    },
  })
);

const findUserByLoginId = (loginId) => prisma.user.findUnique({
  where: { loginId },
  include: {
    employeeProfile: {
      include: {
        branch: true,
      },
    },
  },
});

const findBranchBySlug = (slug) => prisma.branch.findUnique({
  where: { slug },
});

const createBranch = (data, tx = prisma) => tx.branch.create({ data });
const createUser = (data, tx = prisma) => tx.user.create({ data });
const createEmployeeProfile = (data, tx = prisma) => tx.employeeProfile.create({ data });
const createCustomerProfile = (data, tx = prisma) => tx.customerProfile.create({ data });

const findRefreshTokenByHash = (tokenHash) => measureAuthRepository(
  'refresh-token.lookup',
  () => prisma.refreshToken.findFirst({
    where: { tokenHash },
    include: {
      user: {
        include: {
          employeeProfile: {
            include: {
              branch: true,
              position: true,
            },
          },
        },
      },
    },
  })
);

const findRefreshTokenChildren = (replacedByTokenId, tx = prisma) => tx.refreshToken.findMany({
  where: { replacedByTokenId },
  select: { id: true },
});

const createRefreshToken = (data, tx = prisma) => measureAuthRepository(
  'refresh-token.create',
  () => tx.refreshToken.create({ data })
);

const updateRefreshToken = ({ id, data }, tx = prisma) => measureAuthRepository(
  'refresh-token.update',
  () => tx.refreshToken.update({
    where: { id },
    data,
  })
);

const revokeRefreshTokensByIds = ({ ids, revokedAt }, tx = prisma) => tx.refreshToken.updateMany({
  where: { id: { in: ids } },
  data: { revokedAt },
});

const revokeRefreshTokenByHash = ({ tokenHash, revokedAt }, tx = prisma) => tx.refreshToken.updateMany({
  where: {
    tokenHash,
    revokedAt: null,
  },
  data: { revokedAt },
});

const revokeActiveRefreshTokensByUserId = ({ userId, revokedAt }, tx = prisma) => tx.refreshToken.updateMany({
  where: {
    userId,
    revokedAt: null,
  },
  data: { revokedAt },
});

const invalidateActivePasswordResetTokensByUserId = ({ userId, usedAt }, tx = prisma) => (
  tx.passwordResetToken.updateMany({
    where: {
      userId,
      usedAt: null,
    },
    data: { usedAt },
  })
);

const createPasswordResetToken = (data, tx = prisma) => tx.passwordResetToken.create({ data });

const findActivePasswordResetTokenByHash = (tokenHash) => prisma.passwordResetToken.findFirst({
  where: {
    tokenHash,
    usedAt: null,
    expiresAt: { gt: new Date() },
  },
  orderBy: { createdAt: 'desc' },
  include: {
    user: {
      select: {
        id: true,
        enabled: true,
      },
    },
  },
});

const updatePasswordResetToken = ({ id, data }, tx = prisma) => tx.passwordResetToken.update({
  where: { id },
  data,
});

const updateUser = ({ id, data }, tx = prisma) => tx.user.update({
  where: { id },
  data,
});

const runTransaction = (work) => measureAuthRepository(
  'auth.transaction',
  () => prisma.$transaction(work)
);

module.exports = {
  findUserByEmail,
  findLoginUserByEmail,
  findLoginUserByLoginId,
  findEmployeeUserIdByPhone,
  findLoginUserById,
  findPasswordResetEligibleUserByEmail,
  findSessionUserById,
  findUserByLoginId,
  findBranchBySlug,
  createBranch,
  createUser,
  createEmployeeProfile,
  createCustomerProfile,
  findRefreshTokenByHash,
  findRefreshTokenChildren,
  createRefreshToken,
  updateRefreshToken,
  revokeRefreshTokensByIds,
  revokeRefreshTokenByHash,
  revokeActiveRefreshTokensByUserId,
  invalidateActivePasswordResetTokensByUserId,
  createPasswordResetToken,
  findActivePasswordResetTokenByHash,
  updatePasswordResetToken,
  updateUser,
  runTransaction,
};
