const { prisma } = require('../../../../../lib/prisma');

const includeAddress = {
  user: true,
  subdistrict: { include: { district: { include: { province: true } } } },
};

async function findBranchCustomersByName({ branchId, query }) {
  return prisma.customerProfile.findMany({
    where: {
      name: { contains: query, mode: 'insensitive' },
      sale: { some: { branchId } },
    },
    take: 10,
    include: includeAddress,
  });
}

module.exports = {
  findBranchCustomersByName,
};
