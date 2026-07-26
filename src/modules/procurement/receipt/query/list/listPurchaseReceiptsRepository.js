const { prisma } = require('../../../../../../lib/prisma');

const receiptListSelect = {
  id: true,
  code: true,
  receivedAt: true,
  printed: true,
  purchaseOrder: {
    select: {
      code: true,
      supplier: { select: { id: true, name: true } },
    },
  },
};

class ListPurchaseReceiptsRepository {
  constructor(client = prisma) {
    this.client = client;
  }

  async findMany(branchId, filters) {
    const andWhere = [{ branchId }];

    if (typeof filters.printed === 'boolean') {
      andWhere.push({ printed: filters.printed });
    }

    if (filters.q) {
      andWhere.push({
        OR: [
          { code: { contains: filters.q, mode: 'insensitive' } },
          {
            purchaseOrder: {
              is: {
                code: { contains: filters.q, mode: 'insensitive' },
              },
            },
          },
        ],
      });
    }

    if (filters.supplier) {
      andWhere.push({
        purchaseOrder: {
          is: {
            supplier: {
              is: {
                name: { contains: filters.supplier, mode: 'insensitive' },
              },
            },
          },
        },
      });
    }

    if (Number.isFinite(filters.supplierId)) {
      andWhere.push({
        purchaseOrder: {
          is: {
            supplier: {
              is: { id: filters.supplierId },
            },
          },
        },
      });
    }

    return this.client.purchaseOrderReceipt.findMany({
      where: { AND: andWhere },
      select: receiptListSelect,
      orderBy: { receivedAt: 'desc' },
    });
  }
}

module.exports = new ListPurchaseReceiptsRepository();
module.exports.ListPurchaseReceiptsRepository = ListPurchaseReceiptsRepository;
module.exports.receiptListSelect = receiptListSelect;
