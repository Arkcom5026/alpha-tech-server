const { prisma } = require('../../../../../lib/prisma');
const { validateFinancialOwnerLink } = require('../../financial-group/customerFinancialGroupResolver');

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
    const current = await tx.customerProfile.findUnique({ where: { id } });
    const nextType = profileData.type ?? current.type;
    let nextOwnerId = Object.prototype.hasOwnProperty.call(profileData, 'financialOwnerCustomerId')
      ? (profileData.financialOwnerCustomerId ? Number(profileData.financialOwnerCustomerId) : null)
      : current.financialOwnerCustomerId;
    if (nextType === 'INDIVIDUAL') {
      nextOwnerId = null;
      profileData.departmentName = null;
    }
    const counts = await Promise.all([
      tx.customerReceipt.count({ where: { customerId: id } }),
      tx.customerDeposit.count({ where: { customerId: id } }),
      tx.customerMoneyApplication.count({ where: { customerId: id } }),
      tx.customerMoneySettlement.count({ where: { customerId: id } }),
    ]);
    if (counts.some((count) => count > 0) && current.financialOwnerCustomerId !== nextOwnerId) {
      const error = new Error('Cannot re-parent or unlink a customer after financial activity');
      error.code = 'FINANCIAL_GROUP_REPARENT_FORBIDDEN';
      error.statusCode = 409;
      throw error;
    }
    const candidate = { ...current, ...profileData, type: nextType, financialOwnerCustomerId: nextOwnerId };
    const owner = await validateFinancialOwnerLink(tx, { customer: candidate, ownerId: nextOwnerId, branchId: current.branchId });
    if (owner) {
      profileData.type = owner.type;
      profileData.companyName = owner.companyName;
      profileData.taxId = owner.taxId;
    }
    profileData.financialOwnerCustomerId = nextOwnerId;
    await tx.customerProfile.update({
      where: { id },
      data: {
        ...profileData,
        ...(subdistrictCode !== undefined
          ? { subdistrictCode: subdistrictCode || null }
          : {}),
      },
    });
    if (!nextOwnerId && ['ORGANIZATION', 'GOVERNMENT'].includes(nextType)
      && (profileData.companyName !== undefined || profileData.taxId !== undefined || profileData.type !== undefined)) {
      await tx.customerProfile.updateMany({
        where: { financialOwnerCustomerId: id, branchId: current.branchId },
        data: { type: nextType, companyName: candidate.companyName, taxId: candidate.taxId },
      });
    }

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
