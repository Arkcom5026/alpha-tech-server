const { prisma } = require('../../../lib/prisma');

const findEmployeeUserById = (userId) => prisma.user.findUnique({
  where: { id: userId },
  include: {
    employeeProfile: { include: { branch: true, position: true } },
  },
});

module.exports = { findEmployeeUserById };
