class GetCombinableSalesRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async listByBranch(branchId) {
    return this.prisma.sale.findMany({
      where: {
        branchId,
        isCredit: true,
        status: { not: 'CANCELLED' },
        statusPayment: { in: ['PARTIALLY_PAID', 'PAID'] },
        customerId: { not: null },
      },
      include: { customer: true },
      orderBy: { soldAt: 'desc' },
    });
  }
}

module.exports = GetCombinableSalesRepository;
