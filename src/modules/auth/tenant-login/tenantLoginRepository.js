const { prisma } = require('../../../lib/prisma');

const findEmployeeIdentityByEmail = (email) => prisma.user.findUnique({
  where: { email },
  include: {
    employeeProfile: {
      include: {
        branch: true,
        position: true,
      },
    },
  },
});

module.exports = { findEmployeeIdentityByEmail };
