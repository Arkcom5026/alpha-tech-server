const { prisma } = require('../../../../../lib/prisma');

const findSubdistrictPostcode = async (subdistrictCode) =>
  prisma.subdistrict.findUnique({
    where: { code: subdistrictCode },
    select: { postcode: true },
  });

const findActiveCustomerProfile = async ({ customerProfileId, userId }) => {
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
    include: { user: true },
  });
};

const updateCustomerSelf = async ({ userId, existing, profileData, subdistrictCode, phone }) =>
  prisma.$transaction(async (tx) => {
    const profile = await tx.customerProfile.update({
      where: { id: existing.id },
      data: {
        ...profileData,
        ...(subdistrictCode !== undefined
          ? { subdistrictCode: subdistrictCode || null }
          : {}),
      },
    });

    if (phone) {
      await tx.user.update({ where: { id: userId }, data: { loginId: phone } });
    }

    return profile;
  });

const findCustomerDetailById = async ({ id, userId }) =>
  prisma.customerProfile.findFirst({
    where: {
      id: Number(id),
      userId: Number(userId),
    },
    include: {
      user: true,
      subdistrict: { include: { district: { include: { province: true } } } },
    },
  });

module.exports = {
  findSubdistrictPostcode,
  findActiveCustomerProfile,
  updateCustomerSelf,
  findCustomerDetailById,
};
