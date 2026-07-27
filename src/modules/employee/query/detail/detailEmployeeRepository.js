const { prisma } = require('../../../../../lib/prisma');

const findEmployeeByScope = ({ id, branchId, unrestricted }) => prisma.employeeProfile.findFirst({
  where: unrestricted ? { id } : { id, branchId },
  include: { user: true, position: true, branch: true },
});

module.exports = { findEmployeeByScope };
