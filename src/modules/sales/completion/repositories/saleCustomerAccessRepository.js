const { prisma } = require('../../../../../lib/prisma');
const {
  buildCustomerBranchAccessWhere,
} = require('../../../customer/policies/customerBranchAccessPolicy');

const customerSelect = {
  id: true,
  type: true,
  paymentTerms: true,
};

class SaleCustomerAccessRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  findAccessibleCustomer({ customerId, branchId }) {
    return this.prisma.customerProfile.findFirst({
      where: buildCustomerBranchAccessWhere({ customerId, branchId }),
      select: customerSelect,
    });
  }

  findCustomerById(customerId) {
    return this.prisma.customerProfile.findFirst({
      where: { id: Number(customerId) },
      select: customerSelect,
    });
  }
}

module.exports = new SaleCustomerAccessRepository();
module.exports.SaleCustomerAccessRepository = SaleCustomerAccessRepository;
