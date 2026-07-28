const { prisma } = require('../../../lib/prisma');

const createEmployee = async ({ userId, name, phone, branchId, positionId }) => prisma.$transaction(async (tx) => {
  await tx.user.update({
    where: { id: userId },
    data: { role: 'EMPLOYEE', enabled: true },
  });

  return tx.employeeProfile.create({
    data: {
      userId,
      name,
      phone,
      branchId,
      positionId,
      approved: true,
      active: true,
    },
    include: { user: true, position: true, branch: true },
  });
}, { timeout: 15000 });

module.exports = { createEmployee };
