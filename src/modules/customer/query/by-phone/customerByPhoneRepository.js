const { prisma } = require('../../../../../../lib/prisma');

const includeAddress = {
  user: true,
  subdistrict: { include: { district: { include: { province: true } } } },
};

async function findBranchCustomerByPhone({ branchId, phone }) {
  return prisma.customerProfile.findFirst({
    where: {
      user: { loginId: phone },
      sale: { some: { branchId } },
    },
    include: includeAddress,
  });
}

module.exports = {
  findBranchCustomerByPhone,
};
