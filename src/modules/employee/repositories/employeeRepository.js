const { prisma } = require('../../../lib/prisma');

const findEmployeeById = (id) => prisma.employeeProfile.findUnique({
  where: { id },
  include: { user: true, position: true, branch: true },
});

const findPositions = () => prisma.position.findMany({
  orderBy: { name: 'asc' },
});

module.exports = {
  findEmployeeById,
  findPositions,
};
