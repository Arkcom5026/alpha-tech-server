function getDefaultPrismaClient() {
  return require('../../../../database/prisma/client');
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

class UpdateWarrantyClaimStatusRepository {
  constructor(client = null) {
    this.client = client;
  }

  get prisma() {
    return this.client || getDefaultPrismaClient();
  }

  transaction(work) {
    return this.prisma.$transaction((tx) =>
      work(new UpdateWarrantyClaimStatusRepository(tx))
    );
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

  findReplacementStockItem(replacementStockItemId) {
    return this.prisma.stockItem.findUnique({
      where: { id: Number(replacementStockItemId) },
    });
  }

  updateWithEvent(warrantyClaimId, data, event) {
    return this.prisma.warrantyClaim.update({
      where: { id: Number(warrantyClaimId) },
      data: {
        ...data,
        events: {
          create: event,
        },
      },
      include: warrantyClaimDetailInclude,
    });
  }
}

module.exports = new UpdateWarrantyClaimStatusRepository();
module.exports.UpdateWarrantyClaimStatusRepository =
  UpdateWarrantyClaimStatusRepository;
module.exports.warrantyClaimDetailInclude = warrantyClaimDetailInclude;
