const prisma = require('../../../database/prisma/client');
const {
  publishDevicePassportEvent,
} = require('../../device/passport/publish/devicePassportEventPublisher');

const stockItemIntakeInclude = {
  product: { include: { brand: true, productType: true } },
  branch: true,
  devices: {
    where: { status: { not: 'RETIRED' } },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
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
  device: true,
  stockItem: {
    include: {
      product: { include: { brand: true, productType: true } },
      purchaseOrderReceiptItem: {
        include: { receipt: { include: { supplier: true } } },
      },
      saleItems: {
        include: { sale: { include: { customer: { include: { user: true } } } } },
        orderBy: { sale: { soldAt: 'desc' } },
      },
    },
  },
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

class CreateRepairJobRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  transaction(work) {
    return this.prisma.$transaction((tx) => work(new CreateRepairJobRepository(tx)));
  }

  findCustomer(customerId) {
    return this.prisma.customerProfile.findUnique({
      where: { id: Number(customerId) },
      include: { user: true },
    });
  }

  findStockItemForIntake(stockItemId) {
    return this.prisma.stockItem.findUnique({
      where: { id: Number(stockItemId) },
      include: stockItemIntakeInclude,
    });
  }

  findTechnician(technicianId) {
    return this.prisma.employeeProfile.findUnique({
      where: { id: Number(technicianId) },
    });
  }

  create(data) {
    return this.prisma.repairJob.create({
      data,
      include: repairJobDetailInclude,
    });
  }

  publishPassportEvent(event) {
    return publishDevicePassportEvent(this.prisma, event);
  }
}

module.exports = new CreateRepairJobRepository();
module.exports.CreateRepairJobRepository = CreateRepairJobRepository;
