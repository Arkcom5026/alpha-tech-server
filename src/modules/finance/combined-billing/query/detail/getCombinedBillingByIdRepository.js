const { prisma } = require('../../../../../../lib/prisma');

class GetCombinedBillingByIdRepository {
  constructor(prismaClient = prisma) {
    this.prisma = prismaClient;
  }

  findByIdForBranch({ id, branchId }) {
    return this.prisma.combinedBillingDocument.findFirst({
      where: { id, branchId },
      include: {
        customer: true,
        employee: true,
        sales: true,
        documentLines: { orderBy: { id: 'asc' } },
      },
    });
  }
}

module.exports = { GetCombinedBillingByIdRepository };
