const prisma = require('../../../../database/prisma/client');

class CustomerWarrantyAssetsRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  findCustomer(customerId) {
    return this.prisma.customerProfile.findUnique({
      where: { id: Number(customerId) },
      include: { user: true },
    });
  }

  findStructuredAssets(branchId, customerId) {
    return this.prisma.stockItem.findMany({
      where: {
        branchId: Number(branchId),
        saleItems: {
          some: {
            sale: {
              customerId: Number(customerId),
              branchId: Number(branchId),
            },
          },
        },
        OR: [
          { warrantyDays: { gt: 0 } },
          { expiredAt: { not: null } },
          { product: { warrantyDays: { gt: 0 } } },
        ],
      },
      include: {
        product: {
          include: {
            brand: true,
            productType: true,
          },
        },
        saleItems: {
          where: {
            sale: {
              customerId: Number(customerId),
              branchId: Number(branchId),
            },
          },
          include: { sale: true },
          orderBy: { sale: { soldAt: 'desc' } },
          take: 1,
        },
      },
      orderBy: { soldAt: 'desc' },
    });
  }

  findSimpleAssets(branchId, customerId) {
    return this.prisma.saleItemSimple.findMany({
      where: {
        sale: {
          customerId: Number(customerId),
          branchId: Number(branchId),
        },
        product: {
          warrantyDays: { gt: 0 },
        },
      },
      include: {
        product: {
          include: {
            brand: true,
            productType: true,
          },
        },
        sale: true,
      },
      orderBy: { sale: { soldAt: 'desc' } },
    });
  }

  findCustomerWarrantyStockItems(branchId, customerId) {
    return this.findStructuredAssets(branchId, customerId);
  }

  findCustomerWarrantySimpleItems(branchId, customerId) {
    return this.findSimpleAssets(branchId, customerId);
  }
}

module.exports = new CustomerWarrantyAssetsRepository();
module.exports.CustomerWarrantyAssetsRepository = CustomerWarrantyAssetsRepository;
