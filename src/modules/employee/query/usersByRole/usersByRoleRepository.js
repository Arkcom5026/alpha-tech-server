const { prisma } = require('../../../../../lib/prisma');

const findUsersByRole = async (role) => prisma.user.findMany({
  where: { role },
  select: {
    id: true,
    email: true,
    loginId: true,
    role: true,
    enabled: true,
    employeeProfile: { select: { name: true } },
  },
  orderBy: { id: 'asc' },
});

module.exports = { findUsersByRole };
