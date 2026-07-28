const { prisma } = require('../../../../lib/prisma');

const listBranches = () => prisma.branch.findMany({
  select: { id: true, name: true },
  orderBy: { name: 'asc' },
});

module.exports = { listBranches };
