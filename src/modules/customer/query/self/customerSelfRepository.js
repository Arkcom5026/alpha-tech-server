const { prisma } = require('../../../../../lib/prisma');

const includeAddress = {
  user: true,
  subdistrict: { include: { district: { include: { province: true } } } },
};

async function findCustomerByUserId({ userId }) {
  return prisma.customerProfile.findUnique({
    where: { userId },
    include: includeAddress,
  });
}

module.exports = {
  findCustomerByUserId,
};
