const { prisma, Prisma } = require('../../../../../lib/prisma');

const findUserByEmail = (email) => prisma.user.findUnique({
  where: { email },
  select: { id: true },
});

const findPositionForBranch = ({ id, branchId }) => prisma.position.findFirst({
  where: {
    id,
    branchId,
    isActive: true,
  },
  select: { id: true, name: true, branchId: true, isActive: true },
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

const isUniqueConstraintError = (error) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

module.exports = {
  findUserByEmail,
  findPositionForBranch,
  createUser,
  createEmployeeProfile,
  createCustomerProfile,
  runTransaction,
  isUniqueConstraintError,
};
