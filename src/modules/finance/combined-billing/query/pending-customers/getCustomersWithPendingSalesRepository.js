const { prisma } = require('../../../../../../lib/prisma');

class GetCustomersWithPendingSalesRepository {
  constructor(prismaClient = prisma) {
    this.prisma = prismaClient;
  }

  findPendingSales({ branchId, keyword }) {
    return this.prisma.sale.findMany({
      where: {
        branchId,
        isCredit: true,
        status: { not: 'CANCELLED' },
        statusPayment: { in: ['PARTIALLY_PAID', 'PAID'] },
        customerId: { not: null },
        customer: keyword
          ? {
              OR: [
                { name: { contains: keyword, mode: 'insensitive' } },
                { phone: { contains: keyword, mode: 'insensitive' } },
                { companyName: { contains: keyword, mode: 'insensitive' } },
              ],
            }
          : undefined,
      },
      include: { customer: true },
      orderBy: { soldAt: 'asc' },
    });
  }
}

module.exports = { GetCustomersWithPendingSalesRepository };
