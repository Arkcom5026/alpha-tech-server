const { prisma } = require('../../../lib/prisma');

const findRefreshTokenByHash = (tokenHash) => prisma.refreshToken.findFirst({
  where: { tokenHash },
  include: {
    user: {
      include: {
        employeeProfile: { include: { branch: true, position: true } },
      },
    },
  },
  orderBy: { createdAt: 'desc' },
});

const findChildTokenIds = (replacedByTokenId) => prisma.refreshToken.findMany({
  where: { replacedByTokenId },
  select: { id: true },
});

const revokeTokenIds = (ids, revokedAt = new Date()) => prisma.refreshToken.updateMany({
  where: { id: { in: ids } },
  data: { revokedAt },
});

const rotateRefreshToken = ({ existingTokenId, userId, tokenHash, expiresAt, userAgent, ipAddress }) => (
  prisma.$transaction(async (tx) => {
    const refreshToken = await tx.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
      },
    });

    await tx.refreshToken.update({
      where: { id: existingTokenId },
      data: { revokedAt: new Date(), replacedByTokenId: refreshToken.id },
    });

    return refreshToken;
  })
);

const revokeByTokenHash = (tokenHash) => prisma.refreshToken.updateMany({
  where: { tokenHash, revokedAt: null },
  data: { revokedAt: new Date() },
});

const revokeAllByUserId = (userId) => prisma.refreshToken.updateMany({
  where: { userId, revokedAt: null },
  data: { revokedAt: new Date() },
});

module.exports = {
  findRefreshTokenByHash,
  findChildTokenIds,
  revokeTokenIds,
  rotateRefreshToken,
  revokeByTokenHash,
  revokeAllByUserId,
};
