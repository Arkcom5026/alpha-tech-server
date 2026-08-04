const { prisma } = require('../../../../../lib/prisma');

const includeAddress = {
  user: true,
  subdistrict: { include: { district: { include: { province: true } } } },
};

async function findBranchCustomerByPhone({ branchId, phone }) {
  return prisma.customerProfile.findFirst({
    where: {
      branchId: Number(branchId),
      user: { loginId: phone },
    },
    include: includeAddress,
  });
}

module.exports = {
  findBranchCustomerByPhone,
};
