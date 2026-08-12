const { prisma } = require('../../../../lib/prisma');
const {
  buildCustomerBranchAccessWhere,
} = require('../policies/customerBranchAccessPolicy');
const { validateFinancialOwnerLink } = require('../financial-group/customerFinancialGroupResolver');

const includeCustomerGraph = {
  user: true,
  subdistrict: { include: { district: { include: { province: true } } } },
};

function findUserByPhone(loginId) {
  return prisma.user.findUnique({ where: { loginId } });
}

function findCustomerByUserAndBranch({ userId, branchId }) {
  return prisma.customerProfile.findUnique({
    where: {
      branchId_userId: {
        branchId: Number(branchId),
        userId: Number(userId),
      },
    },
    include: includeCustomerGraph,
  });
}

function findAccessibleCustomer({ customerId, branchId }) {
  return prisma.customerProfile.findFirst({
    where: buildCustomerBranchAccessWhere({ customerId, branchId }),
    select: { id: true },
  });
}

function findSubdistrictByCode(code) {
  return prisma.subdistrict.findUnique({
    where: { code },
    select: { postcode: true },
  });
}

function createCustomerProfile({
  existingUser,
  normalizedPhone,
  hashedPassword,
  branchId,
  customer,
}) {
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

    if (customer.financialOwnerCustomerId) {
      await validateFinancialOwnerLink(tx, {
        customer: { id: 0, type: customer.type, companyName: customer.companyName, taxId: customer.taxId },
        ownerId: customer.financialOwnerCustomerId,
        branchId,
      });
    }
    return tx.customerProfile.create({
      data: {
        name: customer.name,
        userId: user.id,
        branchId: Number(branchId),
        type: customer.type || 'INDIVIDUAL',
        companyName: customer.companyName || null,
        departmentName: customer.type === 'INDIVIDUAL' ? null : (customer.departmentName || null),
        financialOwnerCustomerId: customer.type === 'INDIVIDUAL' ? null : (customer.financialOwnerCustomerId || null),
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
  findCustomerByUserAndBranch,
  findAccessibleCustomer,
  findSubdistrictByCode,
  createCustomerProfile,
};
