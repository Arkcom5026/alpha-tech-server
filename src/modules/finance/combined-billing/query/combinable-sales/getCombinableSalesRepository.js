class GetCombinableSalesRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async listByBranch(branchId) {
    return this.prisma.sale.findMany({
      where: {
        branchId,
        status: 'DELIVERED',
        combinedBillingId: null,
        customerId: { not: null },
      },
      include: { customer: true },
      orderBy: { soldAt: 'desc' },
    });
  }
}

module.exports = GetCombinableSalesRepository;
