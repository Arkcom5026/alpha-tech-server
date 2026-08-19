const { prisma } = require('../../../../../../lib/prisma');

class GetCustomersWithPendingSalesRepository {
  constructor(prismaClient = prisma) {
    this.prisma = prismaClient;
  }

  findPendingSales({ branchId, keyword }) {
    return this.prisma.sale.findMany({
      where: {
        branchId,
        status: { not: 'CANCELLED' },
        officialDocumentNumber: { not: null },
        customerId: { not: null },
        OR: [
          {
            isCredit: true,
            statusPayment: { in: ['PARTIALLY_PAID', 'PAID'] },
          },
          {
            isCredit: false,
            statusPayment: 'PAID',
          },
        ],
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
