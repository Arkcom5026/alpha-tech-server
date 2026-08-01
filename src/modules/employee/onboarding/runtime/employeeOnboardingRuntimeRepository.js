const { prisma } = require('../../../../../lib/prisma');

const findUserByEmail = (email) => prisma.user.findUnique({
  where: { email },
  select: { id: true },
});

const findPositionById = (id) => prisma.position.findUnique({
  where: { id },
  select: { id: true, name: true },
});

const createUser = (data, tx = prisma) => tx.user.create({ data });

const createEmployeeProfile = (data, tx = prisma) => tx.employeeProfile.create({
  data,
  include: {
    position: true,
    branch: true,
  },
});

const createCustomerProfile = (data, tx = prisma) => tx.customerProfile.create({ data });

const runTransaction = (work) => prisma.$transaction(work);

module.exports = {
  findUserByEmail,
  findPositionById,
  createUser,
  createEmployeeProfile,
  createCustomerProfile,
  runTransaction,
};
