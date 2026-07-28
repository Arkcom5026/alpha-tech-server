const { prisma } = require('../../../lib/prisma');

const findEmployeeById = (id) => prisma.employeeProfile.findUnique({ where: { id } });

const updateEmployeeStatus = ({ id, userId, active }) => prisma.$transaction(async (tx) => {
  const employee = await tx.employeeProfile.update({
    where: { id },
    data: { active },
    include: { user: true, position: true, branch: true },
  });

  await tx.user.update({
    where: { id: userId },
    data: { enabled: active },
  });

  return {
    ...employee,
    user: employee.user ? { ...employee.user, enabled: active } : employee.user,
  };
}, { timeout: 15000 });

module.exports = { findEmployeeById, updateEmployeeStatus };
