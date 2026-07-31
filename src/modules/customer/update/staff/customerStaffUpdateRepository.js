const { prisma } = require('../../../../../lib/prisma');

const includeUpdatedCustomer = {
  user: true,
  subdistrict: { include: { district: { include: { province: true } } } },
};

async function findCustomerById(id) {
  return prisma.customerProfile.findUnique({
    where: { id },
    include: { user: true },
  });
}

async function findSubdistrictPostcode(code) {
  return prisma.subdistrict.findUnique({
    where: { code },
    select: { postcode: true },
  });
}

async function updateCustomer({ id, userId, profileData, subdistrictCode, phone }) {
  await prisma.$transaction(async (tx) => {
    await tx.customerProfile.update({
      where: { id },
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
  });

  return prisma.customerProfile.findUnique({
    where: { id },
    include: includeUpdatedCustomer,
  });
}

module.exports = {
  findCustomerById,
  findSubdistrictPostcode,
  updateCustomer,
};
