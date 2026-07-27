const prisma = require('../../../database/prisma/client');

const stockItemIntakeInclude = {
  product: { include: { brand: true, productType: true } },
  branch: true,
  purchaseOrderReceiptItem: {
    include: { receipt: { include: { supplier: true } } },
  },
  saleItems: {
    include: { sale: { include: { customer: { include: { user: true } } } } },
    orderBy: { sale: { soldAt: 'desc' } },
  },
  repairJobs: {
    include: {
      customer: { include: { user: true } },
      technician: true,
      warrantyClaims: true,
    },
    orderBy: { createdAt: 'desc' },
  },
  warrantyClaims: {
    include: {
      supplier: true,
      repairJob: true,
      events: { orderBy: { occurredAt: 'desc' } },
    },
    orderBy: { openedAt: 'desc' },
  },
};

const repairJobDetailInclude = {
  branch: true,
  customer: { include: { user: true } },
  stockItem: { include: stockItemIntakeInclude },
  device: true,
  technician: true,
  partsUsed: { include: { product: true } },
  warrantyClaims: {
    include: {
      supplier: true,
      events: {
        include: { performedBy: true },
        orderBy: { occurredAt: 'asc' },
      },
    },
    orderBy: { openedAt: 'desc' },
  },
};

const warrantyClaimDetailInclude = {
  branch: true,
  device: true,
  supplier: true,
  repairJob: {
    include: {
      customer: { include: { user: true } },
      technician: true,
      stockItem: {
        include: {
          product: { include: { brand: true, productType: true } },
        },
      },
    },
  },
  stockItem: {
    include: {
      product: { include: { brand: true, productType: true } },
    },
  },
  events: {
    include: { performedBy: true },
    orderBy: { occurredAt: 'asc' },
  },
};

class RepairRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  transaction(work) {
    return this.prisma.$transaction((tx) => work(new RepairRepository(tx)));
  }

  findCustomer(customerId) {
    return this.prisma.customerProfile.findUnique({
      where: { id: Number(customerId) },
      include: { user: true },
    });
  }

  findStockItemForIntake(branchId, identity) {
    const normalizedIdentity = String(identity).trim();
    const numericId = Number(normalizedIdentity);
    const identityFilters = [
      { barcode: normalizedIdentity },
      { serialNumber: normalizedIdentity },
    ];

    if (Number.isInteger(numericId) && numericId > 0) {
      identityFilters.push({ id: numericId });
    }

    return this.prisma.stockItem.findFirst({
      where: {
        branchId: Number(branchId),
        OR: identityFilters,
      },
      include: stockItemIntakeInclude,
    });
  }

  findCustomerWarrantyStockItems(branchId, customerId) {
    const normalizedBranchId = Number(branchId);
    const normalizedCustomerId = Number(customerId);
    const saleScope = {
      customerId: normalizedCustomerId,
      branchId: normalizedBranchId,
    };

    return this.prisma.stockItem.findMany({
      where: {
        branchId: normalizedBranchId,
        saleItems: { some: { sale: saleScope } },
        OR: [
          { warrantyDays: { gt: 0 } },
          { expiredAt: { not: null } },
          { product: { warrantyDays: { gt: 0 } } },
        ],
      },
      include: {
        product: { include: { brand: true, productType: true } },
        saleItems: {
          where: { sale: saleScope },
          include: { sale: true },
          orderBy: { sale: { soldAt: 'desc' } },
          take: 1,
        },
      },
      orderBy: { soldAt: 'desc' },
    });
  }

  findRepairJob(branchId, repairJobId) {
    return this.prisma.repairJob.findFirst({
      where: { id: Number(repairJobId), branchId: Number(branchId) },
      include: repairJobDetailInclude,
    });
  }

  listRepairJobs(branchId, filters = {}) {
    const where = { branchId: Number(branchId) };
    if (filters.status) where.status = filters.status;
    if (filters.stockItemId != null) where.stockItemId = Number(filters.stockItemId);
    if (filters.customerId != null) where.customerId = Number(filters.customerId);

    return this.prisma.repairJob.findMany({
      where,
      include: repairJobDetailInclude,
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
      skip: filters.offset,
    });
  }

  findWarrantyClaim(branchId, claimId) {
    return this.prisma.warrantyClaim.findFirst({
      where: { id: Number(claimId), branchId: Number(branchId) },
      include: warrantyClaimDetailInclude,
    });
  }

  listWarrantyClaims(branchId, filters = {}) {
    const where = { branchId: Number(branchId) };
    if (filters.status) where.status = filters.status;
    if (filters.stockItemId != null) where.stockItemId = Number(filters.stockItemId);

    return this.prisma.warrantyClaim.findMany({
      where,
      include: warrantyClaimDetailInclude,
      orderBy: { openedAt: 'desc' },
      take: filters.limit,
      skip: filters.offset,
    });
  }

  decrementStockBalance(branchId, productId, quantity) {
    return this.prisma.stockBalance.update({
      where: {
        productId_branchId: {
          productId: Number(productId),
          branchId: Number(branchId),
        },
      },
      data: { quantity: { decrement: quantity } },
    });
  }

  createWarrantyClaim(data, initialEvent) {
    return this.prisma.warrantyClaim.create({
      data: {
        ...data,
        events: { create: initialEvent },
      },
      include: warrantyClaimDetailInclude,
    });
  }

  updateWarrantyClaim(claimId, data, event) {
    return this.prisma.warrantyClaim.update({
      where: { id: Number(claimId) },
      data: {
        ...data,
        events: { create: event },
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
