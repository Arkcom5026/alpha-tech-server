const { prisma } = require('../../../lib/prisma');

const findUserByEmail = (email) => prisma.user.findUnique({ where: { email } });

const findBranchBySlug = (slug) => prisma.branch.findUnique({ where: { slug } });

const createRegistration = ({
  shopName,
  shopSlug,
  email,
  passwordHash,
  categoryId,
  resetTokenHash,
  resetTokenExpiresAt,
}) => prisma.$transaction(async (tx) => {
  const branch = await tx.branch.create({
    data: {
      name: shopName,
      slug: shopSlug,
      address: 'กรุณาอัปเดตที่อยู่ร้านค้า',
      categoryId,
      businessType: 'GENERAL',
    },
  });

  const user = await tx.user.create({
    data: {
      email,
      loginId: email,
      password: passwordHash,
      role: 'ADMIN',
      loginType: 'EMAIL',
      enabled: true,
    },
  });

  const employeeProfile = await tx.employeeProfile.create({
    data: {
      userId: user.id,
      branchId: branch.id,
      name: `${shopName} (Owner)`,
      v2Role: 'OWNER',
      approved: true,
      active: true,
    },
  });

  const customerProfile = await tx.customerProfile.create({
    data: {
      userId: user.id,
      name: `${shopName} (พาร์ตเนอร์คู่ค้า)`,
      type: 'ORGANIZATION',
    },
  });

  await tx.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: resetTokenHash,
      expiresAt: resetTokenExpiresAt,
    },
  });

  return { user, branch, employeeProfile, customerProfile };
});

module.exports = {
  findUserByEmail,
  findBranchBySlug,
  createRegistration,
};
