const { prisma } = require('../../../lib/prisma');

const findByEmail = (email) => prisma.user.findUnique({
  where: { email },
  include: { customerProfile: true, employeeProfile: true },
});

module.exports = { findByEmail };
