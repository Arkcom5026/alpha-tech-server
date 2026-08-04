const { prisma } = require('../../../../../lib/prisma');

const includeAddress = {
  user: true,
  subdistrict: { include: { district: { include: { province: true } } } },
};

async function findActiveCustomerProfile({ customerProfileId, userId }) {
  const profileId = Number(customerProfileId);
  const platformUserId = Number(userId);

  if (
    !Number.isInteger(profileId) ||
    profileId <= 0 ||
    !Number.isInteger(platformUserId) ||
    platformUserId <= 0
  ) {
    return null;
  }

  return prisma.customerProfile.findFirst({
    where: {
      id: profileId,
      userId: platformUserId,
    },
    include: includeAddress,
  });
}

module.exports = {
  findActiveCustomerProfile,
};
