const prisma = require('../../../../../database/prisma/client');

const warrantyClaimDetailInclude = {
  branch: true,
  stockItem: {
    include: {
      product: {
        include: {
          brand: true,
          productType: true,
        },
      },
    },
  },
  device: true,
  supplier: true,
  repairJob: {
    include: {
      customer: {
        include: {
          user: true,
        },
      },
      deviceIntake: {
        include: {
          snapshot: true,
        },
      },
    },
  },
  previousClaim: true,
  subsequentClaims: true,
  replacementStockItem: {
    include: {
      product: true,
    },
  },
  createdBy: true,
  resolvedBy: true,
  events: {
    include: {
      performedBy: true,
    },
    orderBy: {
      occurredAt: 'asc',
    },
  },
};

class ListWarrantyClaimsRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  findMany(branchId, filters) {
    return this.prisma.warrantyClaim.findMany({
      where: {
        branchId: Number(branchId),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.stockItemId ? { stockItemId: filters.stockItemId } : {}),
      },
      include: warrantyClaimDetailInclude,
      orderBy: { openedAt: 'desc' },
      take: filters.limit,
      skip: filters.offset,
    });
  }
}

module.exports = new ListWarrantyClaimsRepository();
module.exports.ListWarrantyClaimsRepository = ListWarrantyClaimsRepository;
module.exports.warrantyClaimDetailInclude = warrantyClaimDetailInclude;
