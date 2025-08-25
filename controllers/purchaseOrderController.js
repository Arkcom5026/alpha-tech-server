// controllers/purchaseOrderController.js
const { prisma, Prisma } = require('../lib/prisma');

// Helpers & Flags
const D = (v) => new Prisma.Decimal(typeof v === 'string' ? v : Number(v));
const toNum = (v) => (v && typeof v === 'object' && 'toNumber' in v ? v.toNumber() : Number(v));
const isMoneyLike = (v) =>
  (typeof v === 'number' && !isNaN(v)) ||
  (typeof v === 'string' && /^\d+(\.\d{1,2})?$/.test(v));
const NORMALIZE_DECIMAL_TO_NUMBER = process.env.NORMALIZE_DECIMAL_TO_NUMBER !== '0';

const generatePurchaseOrderCode = async (branchId) => {
  const paddedBranch = String(branchId).padStart(2, '0');
  const now = new Date();
  const yymm = `${now.getFullYear().toString().slice(2)}${(now.getMonth() + 1)
    .toString()
    .padStart(2, '0')}`;

  const latestPO = await prisma.purchaseOrder.findFirst({
    where: { code: { startsWith: `PO-${paddedBranch}${yymm}-` } },
    orderBy: { code: 'desc' },
  });

  let nextSequence = 1;
  if (latestPO) {
    const lastSequence = parseInt(latestPO.code.slice(-4), 10);
    nextSequence = (isNaN(lastSequence) ? 0 : lastSequence) + 1;
  }

  return `PO-${paddedBranch}${yymm}-${String(nextSequence).padStart(4, '0')}`;
};

// CREATE
const createPurchaseOrder = async (req, res) => {
  try {
    const { supplierId, items = [], note } = req.body;
    const branchId = Number(req.user?.branchId);
    const employeeId = Number(req.user?.employeeId);

    if (!branchId || !employeeId) {
      return res.status(401).json({ error: 'Unauthorized: Missing branchId/employeeId' });
    }
    if (!supplierId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบ (supplierId/items)' });
    }
    for (const it of items) {
      if (!it?.productId || !it?.quantity || !isMoneyLike(it?.costPrice)) {
        return res
          .status(400)
          .json({ error: 'รายการสินค้าไม่ถูกต้อง (productId/quantity/costPrice)' });
      }
    }

    let createdPO;
    for (let attempt = 0; attempt <= 4; attempt++) {
      const code = await generatePurchaseOrderCode(branchId);
      try {
        createdPO = await prisma.$transaction(async (tx) => {
          const po = await tx.purchaseOrder.create({
            data: {
              code,
              supplier: { connect: { id: Number(supplierId) } },
              branch: { connect: { id: branchId } },
              employee: { connect: { id: employeeId } },
              note: note || null,
              status: 'PENDING',
              items: {
                create: items.map((item) => ({
                  productId: Number(item.productId),
                  quantity: Number(item.quantity),
                  costPrice: D(item.costPrice),
                })),
              },
            },
          });

          // update costPrice per-branch
          for (const item of items) {
            await tx.branchPrice.upsert({
              where: { productId_branchId: { productId: Number(item.productId), branchId } },
              update: { costPrice: D(item.costPrice) },
              create: {
                productId: Number(item.productId),
                branchId,
                costPrice: D(item.costPrice),
                isActive: true,
              },
            });
          }

          return po;
        });
        break;
      } catch (err) {
        if (err?.code === 'P2002' && err?.meta?.target?.includes('code') && attempt < 4) continue;
        throw err;
      }
    }

    if (!createdPO) {
      return res
        .status(500)
        .json({ error: 'ไม่สามารถสร้างรหัส PO ที่ไม่ซ้ำได้ กรุณาลองใหม่' });
    }

    res.status(201).json(createdPO);
  } catch (err) {
    console.error('❌ createPurchaseOrder error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// UPDATE STATUS (with branch check)
const updatePurchaseOrderStatus = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Invalid ID' });

    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'Unauthorized: Missing branchId' });

    const po = await prisma.purchaseOrder.findFirst({ where: { id, branchId } });
    if (!po) return res.status(404).json({ error: 'ไม่พบใบสั่งซื้อในสาขานี้' });

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });
    res.json({ success: true, updated });
  } catch (err) {
    console.error('❌ updatePurchaseOrderStatus error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// LIST (filter by branch, status, search)
const getAllPurchaseOrders = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    const { search = '', status = 'all' } = req.query;

    if (!branchId) return res.status(401).json({ error: 'Unauthorized: Missing branchId' });

    const VALID_STATUSES = [
      'PENDING',
      'PARTIALLY_RECEIVED',
      'RECEIVED',
      'PAID',
      'COMPLETED',
      'CANCELLED',
    ];
    const parsedStatuses = String(status)
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => VALID_STATUSES.includes(s));

    const where = {
      branchId,
      ...(parsedStatuses.length > 0 && status !== 'all' ? { status: { in: parsedStatuses } } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: String(search), mode: 'insensitive' } },
              { note: { contains: String(search), mode: 'insensitive' } },
              { supplier: { name: { contains: String(search), mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(purchaseOrders);
  } catch (err) {
    console.error('❌ getAllPurchaseOrders error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ELIGIBLE FOR PAYMENT
const getEligiblePurchaseOrders = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'Unauthorized: Missing branchId' });

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { branchId, paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(purchaseOrders);
  } catch (err) {
    console.error('❌ getEligiblePurchaseOrders error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// BY SUPPLIER (only pending/partially_received) + Decimal-safe total
const getPurchaseOrdersBySupplier = async (req, res) => {
  try {
    const rawSupplierId = req.query.supplierId;
    if (!rawSupplierId || isNaN(Number(rawSupplierId))) {
      return res.status(400).json({ error: 'Invalid supplierId' });
    }

    const supplierId = Number(rawSupplierId);
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'Unauthorized: Missing branchId' });

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { supplierId, branchId, status: { in: ['PENDING', 'PARTIALLY_RECEIVED'] } },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });

    const result = purchaseOrders.map((po) => {
      const total = po.items.reduce(
        (sum, it) => sum.plus(D(it.costPrice).times(Number(it.quantity))),
        new Prisma.Decimal(0)
      );
      return {
        id: po.id,
        code: po.code,
        status: po.status,
        createdAt: po.createdAt,
        totalAmount: NORMALIZE_DECIMAL_TO_NUMBER ? toNum(total) : total,
      };
    });

    res.json(result);
  } catch (err) {
    console.error('❌ getPurchaseOrdersBySupplier error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// GET BY ID (scoped to branch)
const getPurchaseOrderById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Invalid ID' });

    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'Unauthorized: Missing branchId' });

    const po = await prisma.purchaseOrder.findFirst({
      where: { id, branchId },
      include: {
        supplier: true,
        items: { include: { product: { include: { template: true } } } },
      },
    });

    if (!po) return res.status(404).json({ error: 'Purchase Order not found' });
    res.json(po);
  } catch (err) {
    console.error('❌ getPurchaseOrderById error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// UPDATE (items rewritten) + upsert branchPrice — all in one transaction
const updatePurchaseOrder = async (req, res) => {
  try {
    const poId = parseInt(req.params.id, 10);
    const { note, status, items } = req.body;
    const branchId = Number(req.user?.branchId);

    if (!poId) return res.status(400).json({ error: 'Invalid ID' });
    if (!branchId) return res.status(401).json({ error: 'Unauthorized: Missing branchId' });

    const exists = await prisma.purchaseOrder.findFirst({ where: { id: poId, branchId } });
    if (!exists) return res.status(404).json({ error: 'ไม่พบใบสั่งซื้อในสาขานี้' });

    await prisma.$transaction(async (tx) => {
      await tx.purchaseOrder.update({
        where: { id: poId },
        data: { note: note || null, status: status || undefined },
      });

      if (Array.isArray(items)) {
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: poId } });
        await tx.purchaseOrder.update({
          where: { id: poId },
          data: {
            items: {
              create: items.map((item) => ({
                productId: Number(item.productId),
                quantity: Number(item.quantity),
                costPrice: D(item.costPrice),
              })),
            },
          },
        });

        for (const item of items) {
          await tx.branchPrice.upsert({
            where: { productId_branchId: { productId: Number(item.productId), branchId } },
            update: { costPrice: D(item.costPrice) },
            create: {
              productId: Number(item.productId),
              branchId,
              costPrice: D(item.costPrice),
              isActive: true,
            },
          });
        }
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('❌ updatePurchaseOrder error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


// DELETE (scoped)
const deletePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const branchId = Number(req.user?.branchId);

    if (!id || !branchId) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
    }

    const found = await prisma.purchaseOrder.findFirst({
      where: { id: Number(id), branchId },
    });
    if (!found) {
      return res.status(404).json({ error: 'ไม่พบใบสั่งซื้อนี้ในสาขาของคุณ' });
    }

    await prisma.purchaseOrder.delete({ where: { id: Number(id) } });
    res.json({ success: true });
  } catch (err) {
    console.error('❌ deletePurchaseOrder error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// CREATE with supplier advance payments (link + upsert prices) + retry-on-duplicate
const createPurchaseOrderWithAdvance = async (req, res) => {
  try {
    const { supplierId, orderDate, note, items = [], advancePaymentsUsed = [] } = req.body;
    const branchId = Number(req.user?.branchId);
    const employeeId = Number(req.user?.employeeId);

    if (!branchId || !employeeId)
      return res.status(401).json({ message: 'Unauthorized: Missing branchId/employeeId' });
    if (!supplierId || items.length === 0)
      return res.status(400).json({ message: 'ข้อมูลไม่ครบ (supplierId/items)' });

    // ✅ Validate items (strict)
    for (const it of items) {
      const qty = Number(it?.quantity);
      const cost = it?.costPrice;
      if (!it?.productId || !qty || qty <= 0 || !isMoneyLike(cost) || Number(cost) <= 0) {
        return res.status(400).json({ message: 'รายการสินค้าไม่ถูกต้อง (productId, quantity>0, costPrice>0)' });
      }
    }

    // ✅ Validate advance payments shape
    for (const ap of advancePaymentsUsed) {
      if (!ap?.paymentId || !isMoneyLike(ap?.amount) || Number(ap.amount) <= 0) {
        return res.status(400).json({ message: 'ข้อมูลเงินล่วงหน้าไม่ถูกต้อง (paymentId, amount>0)' });
      }
    }

    let createdPOId = null;
    for (let retry = 0; retry < 5 && !createdPOId; retry++) {
      const code = await generatePurchaseOrderCode(branchId);
      try {
        const poId = await prisma.$transaction(async (tx) => {
          const created = await tx.purchaseOrder.create({
            data: {
              code,
              employeeId,
              supplierId: Number(supplierId),
              branchId,
              date: orderDate ? new Date(orderDate) : new Date(),
              note: note || null,
              status: 'PENDING',
              items: {
                create: items.map((item) => ({
                  productId: Number(item.productId),
                  quantity: Number(item.quantity),
                  costPrice: D(item.costPrice),
                })),
              },
            },
          });

          // Upsert latest costPrice per-branch
          for (const item of items) {
            await tx.branchPrice.upsert({
              where: { productId_branchId: { productId: Number(item.productId), branchId } },
              update: { costPrice: D(item.costPrice) },
              create: {
                productId: Number(item.productId),
                branchId,
                costPrice: D(item.costPrice),
                isActive: true,
              },
            });
          }

          // Link supplier advance payments (no overdraw validation here to avoid schema coupling)
          if (advancePaymentsUsed.length > 0) {
            await tx.supplierPaymentPO.createMany({
              data: advancePaymentsUsed.map((entry) => ({
                paymentId: Number(entry.paymentId),
                purchaseOrderId: created.id,
                amountPaid: D(entry.amount || 0),
              })),
            });
          }

          return created.id;
        });

        createdPOId = poId;
      } catch (err) {
        if (err?.code === 'P2002' && err?.meta?.target?.includes('code')) continue;
        throw err;
      }
    }

    if (!createdPOId) {
      return res.status(500).json({ message: 'ไม่สามารถสร้างรหัส PO ที่ไม่ซ้ำได้ กรุณาลองใหม่' });
    }

    // ✅ Return with include
    const out = await prisma.purchaseOrder.findUnique({
      where: { id: createdPOId },
      include: { supplier: true, items: true },
    });

    return res.status(201).json(out);
  } catch (error) {
    console.error('❌ createPurchaseOrderWithAdvance error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


module.exports = {
  getAllPurchaseOrders,
  getEligiblePurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  generatePurchaseOrderCode,
  updatePurchaseOrderStatus,
  getPurchaseOrdersBySupplier,
  createPurchaseOrderWithAdvance,
};
