const { prisma } = require('../../../../../lib/prisma');
const {
  decimal,
  generatePurchaseOrderCode,
  isMoneyLike,
} = require('../shared/purchaseOrderShared');

class CreatePurchaseOrderRepository {
  constructor(client = prisma) { this.prisma = client; }

  generateCode(branchId) {
    return generatePurchaseOrderCode(this.prisma, branchId);
  }

  transaction(work) {
    return this.prisma.$transaction((tx) => work(new CreatePurchaseOrderRepository(tx)));
  }

  create(data) {
    return this.prisma.purchaseOrder.create({ data });
  }

  upsertBranchPrice(branchId, item) {
    return this.prisma.branchPrice.upsert({
      where: {
        productId_branchId: {
          productId: Number(item.productId),
          branchId: Number(branchId),
        },
      },
      update: { costPrice: decimal(item.costPrice) },
      create: {
        productId: Number(item.productId),
        branchId: Number(branchId),
        costPrice: decimal(item.costPrice),
        isActive: true,
      },
    });
  }
}

class CreatePurchaseOrderService {
  constructor(repository = new CreatePurchaseOrderRepository()) { this.repository = repository; }

  validate(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return 'ต้องมีรายการสินค้าอย่างน้อย 1 รายการ';
    }
    for (const item of items) {
      if (!item?.productId || !item?.quantity || !isMoneyLike(item?.costPrice)) {
        return 'รายการสินค้าไม่ถูกต้อง (productId/quantity/costPrice)';
      }
    }
    return null;
  }

  async execute({ branchId, employeeId, supplierId, note, items }) {
    for (let attempt = 0; attempt <= 4; attempt += 1) {
      const code = await this.repository.generateCode(branchId);
      try {
        return await this.repository.transaction(async (tx) => {
          const purchaseOrder = await tx.create({
            code,
            ...(supplierId
              ? { supplier: { connect: { id: Number(supplierId) } } }
              : {}),
            branch: { connect: { id: Number(branchId) } },
            employee: { connect: { id: Number(employeeId) } },
            note: note || null,
            status: 'PENDING',
            items: {
              create: items.map((item) => ({
                productId: Number(item.productId),
                quantity: Number(item.quantity),
                costPrice: decimal(item.costPrice),
              })),
            },
          });
          for (const item of items) await tx.upsertBranchPrice(branchId, item);
          return purchaseOrder;
        });
      } catch (error) {
        if (error?.code === 'P2002' && error?.meta?.target?.includes('code') && attempt < 4) continue;
        throw error;
      }
    }
    return null;
  }
}

class CreatePurchaseOrderController {
  constructor(service = new CreatePurchaseOrderService()) {
    this.service = service;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      const branchId = Number(req.user?.branchId);
      const employeeId = Number(req.user?.employeeId);
      if (!branchId || !employeeId) {
        return res.status(401).json({ error: 'Unauthorized: Missing branchId/employeeId' });
      }
      const items = req.body?.items || [];
      const validationError = this.service.validate(items);
      if (validationError) return res.status(400).json({ error: validationError });
      const result = await this.service.execute({
        branchId,
        employeeId,
        supplierId: req.body?.supplierId,
        note: req.body?.note,
        items,
      });
      if (!result) {
        return res.status(500).json({ error: 'ไม่สามารถสร้างรหัส PO ที่ไม่ซ้ำได้ กรุณาลองใหม่' });
      }
      return res.status(201).json(result);
    } catch (error) {
      console.error('❌ createPurchaseOrder error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = new CreatePurchaseOrderController();
module.exports.CreatePurchaseOrderController = CreatePurchaseOrderController;
module.exports.CreatePurchaseOrderService = CreatePurchaseOrderService;
module.exports.CreatePurchaseOrderRepository = CreatePurchaseOrderRepository;
