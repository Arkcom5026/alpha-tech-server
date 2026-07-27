const { prisma } = require('../../../../../lib/prisma');
const {
  decimal,
  generatePurchaseOrderCode,
  isMoneyLike,
  listInclude,
} = require('../shared/purchaseOrderShared');

class CreatePurchaseOrderWithAdvanceRepository {
  constructor(client = prisma) { this.prisma = client; }
  generateCode(branchId) { return generatePurchaseOrderCode(this.prisma, branchId); }
  transaction(work) {
    return this.prisma.$transaction((tx) => work(new CreatePurchaseOrderWithAdvanceRepository(tx)));
  }
  create(data) { return this.prisma.purchaseOrder.create({ data }); }
  findById(id) {
    return this.prisma.purchaseOrder.findUnique({ where: { id: Number(id) }, include: listInclude });
  }
  upsertBranchPrice(branchId, item) {
    return this.prisma.branchPrice.upsert({
      where: { productId_branchId: { productId: Number(item.productId), branchId: Number(branchId) } },
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

class CreatePurchaseOrderWithAdvanceService {
  constructor(repository = new CreatePurchaseOrderWithAdvanceRepository()) { this.repository = repository; }

  validate(items, advancePaymentsUsed) {
    if (!Array.isArray(items) || items.length === 0) return 'ต้องมีรายการสินค้าอย่างน้อย 1 รายการ';
    for (const item of items) {
      const quantity = Number(item?.quantity);
      if (!item?.productId || !quantity || quantity <= 0 || !isMoneyLike(item?.costPrice) || Number(item.costPrice) <= 0) {
        return 'รายการสินค้าไม่ถูกต้อง (productId, quantity>0, costPrice>0)';
      }
    }
    if (Array.isArray(advancePaymentsUsed) && advancePaymentsUsed.length > 0) {
      return 'ขั้นสร้างใบสั่งซื้อ (PO) ไม่รองรับการใช้เงินล่วงหน้า (advancePaymentsUsed) — กรุณาสร้าง PO แบบปกติ และไปผูก/ตัดชำระเงินในขั้นตอนจ่ายเงิน Supplier ภายหลัง';
    }
    return null;
  }

  async execute({ branchId, employeeId, supplierId, orderDate, note, items }) {
    let id = null;
    for (let retry = 0; retry < 5 && !id; retry += 1) {
      const code = await this.repository.generateCode(branchId);
      try {
        id = await this.repository.transaction(async (tx) => {
          const created = await tx.create({
            code,
            employeeId: Number(employeeId),
            supplierId: supplierId ? Number(supplierId) : null,
            branchId: Number(branchId),
            date: orderDate ? new Date(orderDate) : new Date(),
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
          return created.id;
        });
      } catch (error) {
        if (error?.code === 'P2002' && error?.meta?.target?.includes('code')) continue;
        throw error;
      }
    }
    return id ? this.repository.findById(id) : null;
  }
}

class CreatePurchaseOrderWithAdvanceController {
  constructor(service = new CreatePurchaseOrderWithAdvanceService()) {
    this.service = service;
    this.handle = this.handle.bind(this);
  }
  async handle(req, res) {
    try {
      const branchId = Number(req.user?.branchId);
      const employeeId = Number(req.user?.employeeId);
      if (!branchId || !employeeId) return res.status(401).json({ message: 'Unauthorized: Missing branchId/employeeId' });
      const items = req.body?.items || [];
      const validationError = this.service.validate(items, req.body?.advancePaymentsUsed);
      if (validationError) return res.status(400).json({ message: validationError });
      const result = await this.service.execute({
        branchId,
        employeeId,
        supplierId: req.body?.supplierId,
        orderDate: req.body?.orderDate,
        note: req.body?.note,
        items,
      });
      if (!result) return res.status(500).json({ message: 'ไม่สามารถสร้างรหัส PO ที่ไม่ซ้ำได้ กรุณาลองใหม่' });
      return res.status(201).json(result);
    } catch (error) {
      console.error('❌ createPurchaseOrderWithAdvance error:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }
}

module.exports = new CreatePurchaseOrderWithAdvanceController();
module.exports.CreatePurchaseOrderWithAdvanceController = CreatePurchaseOrderWithAdvanceController;
module.exports.CreatePurchaseOrderWithAdvanceService = CreatePurchaseOrderWithAdvanceService;
module.exports.CreatePurchaseOrderWithAdvanceRepository = CreatePurchaseOrderWithAdvanceRepository;
