const dayjs = require('dayjs');
const { prisma } = require('../../../../../lib/prisma');

const purchaseOrderProjection = {
  id: true,
  branchId: true,
  code: true,
  supplier: { select: { name: true } },
  items: { select: { productId: true, costPrice: true } },
};

const createdReceiptInclude = {
  purchaseOrder: {
    select: {
      id: true,
      code: true,
      supplier: { select: { name: true } },
      items: { select: { productId: true, costPrice: true } },
    },
  },
};

class CreatePurchaseReceiptRepository {
  constructor(client = prisma) {
    this.client = client;
  }

  findPurchaseOrder(purchaseOrderId, branchId) {
    return this.client.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, branchId },
      select: purchaseOrderProjection,
    });
  }

  async generateReceiptCode(branchId, client = this.client) {
    const paddedBranch = String(branchId).padStart(2, '0');
    const prefix = `RC-${paddedBranch}${dayjs().format('YYMM')}`;
    const latest = await client.purchaseOrderReceipt.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    const lastSequence = latest?.code
      ? Number.parseInt(latest.code.split('-').pop(), 10)
      : 0;
    const nextNumber = (Number.isNaN(lastSequence) ? 0 : lastSequence) + 1;
    return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
  }

  async createWithUniqueCode({
    purchaseOrderId,
    branchId,
    employeeId,
    note,
    supplierTaxInvoiceNumber,
    supplierTaxInvoiceDate,
    receivedAt,
  }) {
    const maxRetries = 3;
    let created = null;

    await this.client.$transaction(
      async (tx) => {
        for (let attempt = 0; attempt < maxRetries; attempt += 1) {
          const code = await this.generateReceiptCode(branchId, tx);
          try {
            created = await tx.purchaseOrderReceipt.create({
              data: {
                note,
                code,
                supplierTaxInvoiceNumber,
                supplierTaxInvoiceDate,
                receivedAt,
                branch: { connect: { id: branchId } },
                purchaseOrder: { connect: { id: purchaseOrderId } },
                receivedBy: { connect: { id: employeeId } },
              },
              include: createdReceiptInclude,
            });
            break;
          } catch (error) {
            const codeCollision =
              error?.code === 'P2002' &&
              String(error?.meta?.target).includes('code');
            if (codeCollision && attempt < maxRetries - 1) continue;
            throw error;
          }
        }

        if (!created) throw new Error('สร้างรหัสใบรับสินค้าแบบไม่ซ้ำไม่สำเร็จ');
      },
      { timeout: 20000, maxWait: 8000 }
    );

    return created;
  }

  upsertBranchPrice({ productId, branchId, costPrice }) {
    return this.client.branchPrice.upsert({
      where: { productId_branchId: { productId, branchId } },
      update: { costPrice },
      create: { productId, branchId, costPrice },
    });
  }
}

module.exports = new CreatePurchaseReceiptRepository();
module.exports.CreatePurchaseReceiptRepository = CreatePurchaseReceiptRepository;
module.exports.purchaseOrderProjection = purchaseOrderProjection;
module.exports.createdReceiptInclude = createdReceiptInclude;
