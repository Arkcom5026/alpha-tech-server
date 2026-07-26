const prisma = require('../../../../database/prisma/client');

const intakeContextInclude = {
  product: {
    include: {
      brand: true,
      productType: true,
    },
  },
  branch: true,
  purchaseOrderReceiptItem: {
    include: {
      receipt: {
        include: {
          supplier: true,
        },
      },
    },
  },
  saleItems: {
    include: {
      sale: {
        include: {
          customer: {
            include: {
              user: true,
            },
          },
        },
      },
    },
    orderBy: {
      sale: {
        soldAt: 'desc',
      },
    },
  },
  repairJobs: {
    include: {
      customer: {
        include: {
          user: true,
        },
      },
      technician: true,
      warrantyClaims: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
  warrantyClaims: {
    include: {
      supplier: true,
      repairJob: true,
      events: {
        orderBy: {
          occurredAt: 'desc',
        },
      },
    },
    orderBy: {
      openedAt: 'desc',
    },
  },
};

class IntakeContextRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  findByLookup(branchId, lookup) {
    const numericLookup = Number(lookup);
    const idClause =
      Number.isInteger(numericLookup) && numericLookup > 0
        ? [{ id: numericLookup }]
        : [];

    return this.prisma.stockItem.findFirst({
      where: {
        branchId: Number(branchId),
        OR: [
          { barcode: lookup },
          { serialNumber: lookup },
          ...idClause,
        ],
      },
      include: intakeContextInclude,
    });
  }
}

module.exports = new IntakeContextRepository();
module.exports.IntakeContextRepository = IntakeContextRepository;
module.exports.intakeContextInclude = intakeContextInclude;
