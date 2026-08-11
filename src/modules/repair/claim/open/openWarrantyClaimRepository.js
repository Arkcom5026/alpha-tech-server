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

class OpenWarrantyClaimRepository {
  constructor(client = null) {
    this.prisma = client;
  }

  getClient() {
    if (!this.prisma) {
      this.prisma = require('../../../../database/prisma/client');
    }
    return this.prisma;
  }

  transaction(work) {
    return this.getClient().$transaction((tx) =>
      work(new OpenWarrantyClaimRepository(tx))
    );
  }

  findRepairJob(branchId, repairJobId) {
    return this.getClient().repairJob.findFirst({
      where: {
        id: Number(repairJobId),
        branchId: Number(branchId),
      },
      include: {
        stockItem: {
          include: {
            purchaseOrderReceiptItem: {
              include: {
                receipt: {
                  include: {
                    supplier: true,
                  },
                },
              },
            },
          },
        },
        device: true,
        warrantyClaims: true,
      },
    });
  }

  async findActiveSubcontract(repairJobId) {
    const rows = await this.getClient().$queryRawUnsafe(
      `SELECT "id", "status", "providerName"
       FROM "RepairSubcontract"
       WHERE "repairJobId" = $1 AND "status" IN ('SENT','RETURN_REQUESTED')
       ORDER BY "sentAt" DESC, "id" DESC
       LIMIT 1
       FOR UPDATE`,
      Number(repairJobId)
    );
    return rows[0] || null;
  }

  findLatestWorkflowEvent(branchId, repairJobId, deviceId) {
    return this.getClient().devicePassportEvent.findFirst({
      where: {
        branchId: Number(branchId),
        deviceId: Number(deviceId),
        sourceType: 'REPAIR_JOB',
        sourceId: String(repairJobId),
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    });
  }

  findSupplier(supplierId) {
    return this.getClient().supplier.findUnique({
      where: { id: Number(supplierId) },
    });
  }

  createWarrantyClaim(data, initialEvent) {
    return this.getClient().warrantyClaim.create({
      data: {
        ...data,
        events: {
          create: initialEvent,
        },
      },
      include: warrantyClaimDetailInclude,
    });
  }
}

module.exports = new OpenWarrantyClaimRepository();
module.exports.OpenWarrantyClaimRepository = OpenWarrantyClaimRepository;
module.exports.warrantyClaimDetailInclude = warrantyClaimDetailInclude;
