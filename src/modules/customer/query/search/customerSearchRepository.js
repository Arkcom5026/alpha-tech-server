const { prisma } = require('../../../../../lib/prisma');
const {
  buildCustomerBranchEvidence,
} = require('../../policies/customerBranchAccessPolicy');

const customerSelect = {
  id: true,
  name: true,
  companyName: true,
  departmentName: true,
  financialOwnerCustomerId: true,
  taxId: true,
  type: true,
  addressDetail: true,
  creditLimit: true,
  creditBalance: true,
  user: { select: { loginId: true, email: true } },
  subdistrict: {
    include: { district: { include: { province: true } } },
  },
};

async function searchBranchCustomers({ branchId, query, limit = 20 }) {
  const contains = { contains: query, mode: 'insensitive' };

  return prisma.customerProfile.findMany({
    where: {
      AND: [
        buildCustomerBranchEvidence(branchId),
        {
          OR: [
            { name: contains },
            { companyName: contains },
            { departmentName: contains },
            { taxId: contains },
            { user: { loginId: contains } },
            { user: { email: contains } },
          ],
        },
      ],
    },
    select: customerSelect,
    orderBy: [{ companyName: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    take: limit,
  });
}

module.exports = { searchBranchCustomers };
