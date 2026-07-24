const { prisma } = require('../../../lib/prisma');

const employeeInclude = {
  user: true,
  position: true,
  branch: true,
};

const findEmployees = ({ branchId } = {}) => prisma.employeeProfile.findMany({
  where: branchId ? { branchId } : undefined,
  include: employeeInclude,
  orderBy: { id: 'desc' },
});

const findEmployeeById = (id) => prisma.employeeProfile.findUnique({
  where: { id },
  include: employeeInclude,
});

const findEmployeeUserByEmail = (email) => prisma.user.findUnique({
  where: { email },
  select: { id: true },
});

const findPositionById = (id) => prisma.position.findUnique({
  where: { id },
  select: { id: true, name: true },
});

const findPositions = () => prisma.position.findMany({
  orderBy: { name: 'asc' },
});

const createEmployeeTransaction = (callback) => prisma.$transaction(callback);

module.exports = {
  findEmployees,
  findEmployeeById,
  findEmployeeUserByEmail,
  findPositionById,
  findPositions,
  createEmployeeTransaction,
};
