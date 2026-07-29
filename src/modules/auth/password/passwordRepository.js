const { prisma } = require('../../../lib/prisma');

const findEnabledUserByEmail = (email) => prisma.user.findUnique({
  where: { email },
  select: { id: true, email: true, enabled: true },
});

const replaceActiveResetToken = ({ userId, tokenHash, expiresAt }) => prisma.$transaction(async (tx) => {
  await tx.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  return tx.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt },
  });
});

const findValidResetToken = (tokenHash) => prisma.passwordResetToken.findFirst({
  where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
  orderBy: { createdAt: 'desc' },
  include: { user: { select: { id: true, enabled: true } } },
});

const resetPasswordAndInvalidateTokens = ({ resetRecordId, userId, passwordHash }) => prisma.$transaction(async (tx) => {
  await tx.user.update({
    where: { id: userId },
    data: { password: passwordHash },
  });

  await tx.passwordResetToken.update({
    where: { id: resetRecordId },
    data: { usedAt: new Date() },
  });

  await tx.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
});

module.exports = {
  findEnabledUserByEmail,
  replaceActiveResetToken,
  findValidResetToken,
  resetPasswordAndInvalidateTokens,
};