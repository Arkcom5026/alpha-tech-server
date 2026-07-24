const prisma = require('../../../database/prisma/client');

const stockItemIntakeInclude = {
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

const repairJobDetailInclude = {
  branch: true,
  customer: {
    include: {
      user: true,
    },
  },
  stockItem: {
    include: {
      product: {
        include: {
          brand: true,
          productType: true,
        },
      },
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
    },
  },
  technician: true,
  partsUsed: {
    include: {
      product: true,
    },
  },
  warrantyClaims: {
    include: {
      supplier: true,
      events: {
        include: {
          performedBy: true,
        },
        orderBy: {
          occurredAt: 'asc',
        },
      },
    },
    orderBy: {
      openedAt: 'desc',
    },
  },
};

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

class RepairRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  transaction(work) {
    return this.prisma.$transaction((tx) => work(new RepairRepository(tx)));
  }

  findStockItemForIntake(branchId, lookup) {
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
      include: stockItemIntakeInclude,
    });
  }

  findStockItemByIdForIntake(stockItemId) {
    return this.prisma.stockItem.findUnique({
      where: { id: Number(stockItemId) },
      include: stockItemIntakeInclude,
    });
  }

  findCustomer(customerId) {
    return this.prisma.customerProfile.findUnique({
      where: { id: Number(customerId) },
      include: { user: true },
    });
  }

  findEmployee(employeeId) {
    return this.prisma.employeeProfile.findUnique({
      where: { id: Number(employeeId) },
    });
  }

  findSupplier(supplierId) {
    return this.prisma.supplier.findUnique({
      where: { id: Number(supplierId) },
    });
  }

  findProduct(productId) {
    return this.prisma.product.findUnique({
      where: { id: Number(productId) },
    });
  }

  findStockBalance(branchId, productId) {
    return this.prisma.stockBalance.findUnique({
      where: {
        productId_branchId: {
          productId: Number(productId),
          branchId: Number(branchId),
        },
      },
    });
  }

  findBranchPrice(branchId, productId) {
    return this.prisma.branchPrice.findUnique({
      where: {
        productId_branchId: {
          productId: Number(productId),
          branchId: Number(branchId),
        },
      },
    });
  }

  createRepairJob(data) {
    return this.prisma.repairJob.create({
      data,
      include: repairJobDetailInclude,
    });
  }

  findRepairJob(branchId, repairJobId) {
    return this.prisma.repairJob.findFirst({
      where: {
        id: Number(repairJobId),
        branchId: Number(branchId),
      },
      include: repairJobDetailInclude,
    });
  }

  listRepairJobs(branchId, filters) {
    return this.prisma.repairJob.findMany({
      where: {
        branchId: Number(branchId),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.stockItemId ? { stockItemId: filters.stockItemId } : {}),
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
      },
      include: repairJobDetailInclude,
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
      skip: filters.offset,
    });
  }

  updateRepairJob(repairJobId, data) {
    return this.prisma.repairJob.update({
      where: { id: Number(repairJobId) },
      data,
      include: repairJobDetailInclude,
    });
  }

  createRepairPart(data) {
    return this.prisma.repairPartItem.create({
      data,
      include: { product: true },
    });
  }

  decrementStockBalance(branchId, productId, qtyUsed) {
    return this.prisma.stockBalance.update({
      where: {
        productId_branchId: {
          productId: Number(productId),
          branchId: Number(branchId),
        },
      },
      data: {
        quantity: { decrement: qtyUsed },
      },
    });
  }

  createStockMovement(data) {
    return this.prisma.stockMovement.create({ data });
  }

  createWarrantyClaim(data, initialEvent) {
    return this.prisma.warrantyClaim.create({
      data: {
        ...data,
        events: {
          create: initialEvent,
        },
      },
      include: warrantyClaimDetailInclude,
    });
  }

  findWarrantyClaim(branchId, warrantyClaimId) {
    return this.prisma.warrantyClaim.findFirst({
      where: {
        id: Number(warrantyClaimId),
        branchId: Number(branchId),
      },
      include: warrantyClaimDetailInclude,
    });
  }

  listWarrantyClaims(branchId, filters) {
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

  updateWarrantyClaim(warrantyClaimId, data, event) {
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

RepairRepository.stockItemIntakeInclude = stockItemIntakeInclude;
RepairRepository.repairJobDetailInclude = repairJobDetailInclude;
RepairRepository.warrantyClaimDetailInclude = warrantyClaimDetailInclude;

module.exports = new RepairRepository();
module.exports.RepairRepository = RepairRepository;
