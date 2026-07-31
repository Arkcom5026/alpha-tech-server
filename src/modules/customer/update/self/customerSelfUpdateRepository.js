const { prisma } = require('../../../../../lib/prisma');

const findSubdistrictPostcode = async (subdistrictCode) =>
  prisma.subdistrict.findUnique({
    where: { code: subdistrictCode },
    select: { postcode: true },
  });

const findCustomerByUserId = async (userId) =>
  prisma.customerProfile.findUnique({
    where: { userId },
    include: { user: true },
  });

const updateCustomerSelf = async ({ userId, existing, profileData, subdistrictCode, phone }) =>
  prisma.$transaction(async (tx) => {
    const profile = existing
      ? await tx.customerProfile.update({
          where: { id: existing.id },
          data: {
            ...profileData,
            ...(subdistrictCode !== undefined
              ? { subdistrictCode: subdistrictCode || null }
              : {}),
          },
        })
      : await tx.customerProfile.create({
          data: {
            userId,
            ...profileData,
            ...(subdistrictCode ? { subdistrictCode } : {}),
          },
        });

    if (phone) {
      await tx.user.update({ where: { id: userId }, data: { loginId: phone } });
    }

    return profile;
  });

const findCustomerDetailById = async (id) =>
  prisma.customerProfile.findUnique({
    where: { id },
    include: {
      user: true,
      subdistrict: { include: { district: { include: { province: true } } } },
    },
  });

module.exports = {
  findSubdistrictPostcode,
  findCustomerByUserId,
  updateCustomerSelf,
  findCustomerDetailById,
};
