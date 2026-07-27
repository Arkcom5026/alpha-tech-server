const { prisma } = require('../../../../lib/prisma');

const findEmployeeProfileByUserId = (userId) => prisma.employeeProfile.findUnique({ where: { userId } });

const updateUserRole = ({ userId, role }) => prisma.user.update({
  where: { id: userId },
  data: { role },
});

module.exports = { findEmployeeProfileByUserId, updateUserRole };
