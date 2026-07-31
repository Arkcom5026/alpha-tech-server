const { prisma } = require('../../../../lib/prisma');

const includeCustomerGraph = {
  user: true,
  subdistrict: { include: { district: { include: { province: true } } } },
};

function findUserByPhone(loginId) {
  return prisma.user.findUnique({ where: { loginId } });
}

function findCustomerByUserId(userId) {
  return prisma.customerProfile.findFirst({
    where: { userId },
    include: includeCustomerGraph,
  });
}

function findSubdistrictByCode(code) {
  return prisma.subdistrict.findUnique({
    where: { code },
    select: { postcode: true },
  });
}

function createCustomerProfile({ existingUser, normalizedPhone, hashedPassword, customer }) {
  return prisma.$transaction(async (tx) => {
    const user = existingUser
      ? existingUser
      : await tx.user.create({
          data: {
            email: null,
            loginId: normalizedPhone,
            password: hashedPassword,
            role: 'CUSTOMER',
            loginType: 'PHONE',
          },
        });

    return tx.customerProfile.create({
      data: {
        name: customer.name,
        userId: user.id,
        type: customer.type || 'INDIVIDUAL',
        companyName: customer.companyName || null,
        taxId: customer.taxId || null,
        addressDetail:
          typeof customer.addressDetail === 'string' ? customer.addressDetail.trim() : null,
        ...(customer.subdistrictCode ? { subdistrictCode: customer.subdistrictCode } : {}),
      },
      include: includeCustomerGraph,
    });
  });
}

module.exports = {
  findUserByPhone,
  findCustomerByUserId,
  findSubdistrictByCode,
  createCustomerProfile,
};
