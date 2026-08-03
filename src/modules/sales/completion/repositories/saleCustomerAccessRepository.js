const { prisma } = require('../../../../../lib/prisma');
const {
  buildCustomerBranchAccessWhere,
} = require('../../../customer/policies/customerBranchAccessPolicy');

class SaleCustomerAccessRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  findAccessibleCustomer({ customerId, branchId }) {
    return this.prisma.customerProfile.findFirst({
      where: buildCustomerBranchAccessWhere({ customerId, branchId }),
      select: {
        id: true,
        type: true,
        paymentTerms: true,
      },
    });
  }
}

module.exports = new SaleCustomerAccessRepository();
module.exports.SaleCustomerAccessRepository = SaleCustomerAccessRepository;
