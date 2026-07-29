const { prisma } = require('../../../lib/prisma');

const findUserByEmail = (email) => prisma.user.findUnique({
  where: { email },
  select: { id: true },
});

const findPositionById = (positionId) => prisma.position.findUnique({
  where: { id: positionId },
  select: { id: true, name: true },
});

const createEmployee = ({ branchId, positionId, name, email, phone, v2Role, passwordHash }) => (
  prisma.$transaction(async (tx) => {
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
  })
);

module.exports = {
  findUserByEmail,
  findPositionById,
  createEmployee,
};
