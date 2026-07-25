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

const findPositionByIdForBranch = (id, branchId) => prisma.position.findFirst({
  where: { id, branchId },
  select: { id: true, name: true, branchId: true },
});

const findPositions = ({ branchId } = {}) => prisma.position.findMany({
  where: branchId ? { branchId } : undefined,
  orderBy: { name: 'asc' },
});

const createEmployee = (callback) => prisma.$transaction(callback);

module.exports = {
  findEmployees,
  findEmployeeById,
  findEmployeeUserByEmail,
  findPositionByIdForBranch,
  findPositions,
  createEmployee,
};
