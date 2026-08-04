const { prisma } = require('../../../../../lib/prisma');

const includeAddress = {
  user: true,
  subdistrict: { include: { district: { include: { province: true } } } },
};

async function findBranchCustomersByName({ branchId, query }) {
  return prisma.customerProfile.findMany({
    where: {
      branchId: Number(branchId),
      name: { contains: query, mode: 'insensitive' },
    },
    take: 10,
    include: includeAddress,
  });
}

module.exports = {
  findBranchCustomersByName,
};
