function getDefaultPrismaClient() {
  return require('../../../../../database/prisma/client');
}

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

class GetWarrantyClaimRepository {
  constructor(client = null) {
    this.client = client;
  }

  get prisma() {
    return this.client || getDefaultPrismaClient();
  }

  findById(branchId, warrantyClaimId) {
    return this.prisma.warrantyClaim.findFirst({
      where: {
        id: Number(warrantyClaimId),
        branchId: Number(branchId),
      },
      include: warrantyClaimDetailInclude,
    });
  }
}

module.exports = new GetWarrantyClaimRepository();
module.exports.GetWarrantyClaimRepository = GetWarrantyClaimRepository;
module.exports.warrantyClaimDetailInclude = warrantyClaimDetailInclude;
