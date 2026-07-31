const { prisma } = require('../../../../../lib/prisma');

const findUserByEmail = (email) => prisma.user.findUnique({
  where: { email },
  include: {
    employeeProfile: {
      include: {
        branch: true,
      },
    },
  },
});

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

const findRefreshTokenByHash = (tokenHash) => prisma.refreshToken.findUnique({
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
});

const findRefreshTokenChildren = (replacedByTokenId, tx = prisma) => tx.refreshToken.findMany({
  where: { replacedByTokenId },
  select: { id: true },
});

const createRefreshToken = (data, tx = prisma) => tx.refreshToken.create({ data });

const updateRefreshToken = ({ id, data }, tx = prisma) => tx.refreshToken.update({
  where: { id },
  data,
});

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

const createPasswordResetToken = (data, tx = prisma) => tx.passwordResetToken.create({ data });

const findPasswordResetTokenByHash = (tokenHash) => prisma.passwordResetToken.findUnique({
  where: { tokenHash },
  include: { user: true },
});

const updatePasswordResetToken = ({ id, data }, tx = prisma) => tx.passwordResetToken.update({
  where: { id },
  data,
});

const updateUser = ({ id, data }, tx = prisma) => tx.user.update({
  where: { id },
  data,
});

const runTransaction = (work) => prisma.$transaction(work);

module.exports = {
  findUserByEmail,
  findUserByLoginId,
  findBranchBySlug,
  findRefreshTokenByHash,
  findRefreshTokenChildren,
  createRefreshToken,
  updateRefreshToken,
  revokeRefreshTokensByIds,
  revokeRefreshTokenByHash,
  revokeActiveRefreshTokensByUserId,
  createPasswordResetToken,
  findPasswordResetTokenByHash,
  updatePasswordResetToken,
  updateUser,
  runTransaction,
};
