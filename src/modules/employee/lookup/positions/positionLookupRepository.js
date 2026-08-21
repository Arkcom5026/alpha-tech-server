const { prisma } = require('../../../../lib/prisma');

const listPositions = ({ branchId }) => prisma.position.findMany({
  where: {
    branchId,
    isActive: true,
  },
  select: {
    id: true,
    name: true,
    description: true,
    branchId: true,
    isActive: true,
  },
  orderBy: { name: 'asc' },
});

module.exports = { listPositions };
