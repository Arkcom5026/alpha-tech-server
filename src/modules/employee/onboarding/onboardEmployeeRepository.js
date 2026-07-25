const bcrypt = require('bcryptjs');
const { prisma } = require('../../../../lib/prisma');

const findExistingUserAndPosition = async ({ email, positionId }) => Promise.all([
  prisma.user.findUnique({ where: { email }, select: { id: true } }),
  prisma.position.findUnique({ where: { id: positionId }, select: { id: true, name: true } }),
]);

const hashPassword = async (password) => bcrypt.hash(password, 10);

const createOnboardedEmployee = async ({
  email,
  passwordHash,
  branchId,
  positionId,
  name,
  phone,
  v2Role,
}) => prisma.$transaction(async (tx) => {
  const user = await tx.user.create({
    data: {
      email,
      loginId: email,
      password: passwordHash,
      role: 'EMPLOYEE',
      loginType: 'EMAIL',
      enabled: true,
    },
  });

  const employeeProfile = await tx.employeeProfile.create({
    data: {
      userId: user.id,
      branchId,
      positionId,
      name,
      phone,
      v2Role,
      approved: true,
      active: true,
    },
    include: { position: true, branch: true },
  });

  await tx.customerProfile.create({
    data: {
      userId: user.id,
      name,
      type: 'INDIVIDUAL',
    },
  });

  return { user, employeeProfile };
});

module.exports = {
  findExistingUserAndPosition,
  hashPassword,
  createOnboardedEmployee,
};
