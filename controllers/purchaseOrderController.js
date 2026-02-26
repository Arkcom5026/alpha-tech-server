











// controllers/purchaseOrderController.js
const { Prisma } = require('@prisma/client');
const { prisma } = require('../lib/prisma');

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

// ────────────────────────────────────────────────────────────────────────────────
// READ: List / Eligible / Detail / Supplier-scoped list (branch-scoped)
// ────────────────────────────────────────────────────────────────────────────────
const parseStatusCsv = (v) => {
  if (!v) return [];
  const list = Array.isArray(v) ? v : String(v).split(',');
  return list.map((s) => String(s).trim().toUpperCase()).filter(Boolean);
};

const getAllPurchaseOrders = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'Unauthorized: Missing branchId' });

    const page = Math.max(1, Number(req.query?.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query?.pageSize) || 50));
    const search = (req.query?.search || '').toString().trim();
    const statuses = parseStatusCsv(req.query?.status);

    const where = {
      branchId,
      ...(statuses.length ? { status: { in: statuses } } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { supplier: { is: { name: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        items: { include: { product: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return res.json(purchaseOrders);
  } catch (err) {
    console.error('❌ getAllPurchaseOrders error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getEligiblePurchaseOrders = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'Unauthorized: Missing branchId' });

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { branchId, status: { in: ['PENDING', 'PARTIALLY_RECEIVED'] } },
      include: {
        supplier: true,
        items: { include: { product: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(purchaseOrders);
  } catch (err) {
    console.error('❌ getEligiblePurchaseOrders error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

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
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                category: { select: { name: true } },
                productType: { select: { name: true } },
                brand: { select: { name: true } },
                productProfile: { select: { name: true } },
                template: {
                  select: {
                    name: true,
                    unit: { select: { name: true } },
                  },
                },
                unit: { select: { name: true } },
              },
            },
            // ✅ Prisma schema จริงใช้ relation ชื่อ receipts (ไม่ใช่ receiptItems)
            // ใช้แค่ quantity สำหรับคำนวณ receivedQuantity
            receipts: { select: { id: true, quantity: true } },
          },
        },
      },
    });

    if (!po) return res.status(404).json({ error: 'Purchase Order not found' });

    // ✅ normalize ให้ FE ใช้คอลัมน์ได้ครบ + กันพังแบบ minimal disruption
    const normalized = {
      ...po,
      items: (po.items || []).map((it) => {
        const p = it.product || {};

        // receivedQuantity = sum of receipt quantities
        const receivedQuantity = (it.receipts || []).reduce((sum, r) => sum + toNum(r.quantity), 0);

        return {
          ...it,
          // ✅ alias เผื่อ FE เดิมยังอ้าง receiptItems
          receiptItems: it.receipts || [],
          receivedQuantity,

          // flatten names for table
          categoryName: p.category?.name ?? null,
          productTypeName: p.productType?.name ?? null,
          brandName: p.brand?.name ?? null,
          productProfileName: p.productProfile?.name ?? null,
          productTemplateName: p.template?.name ?? null,
          unitName: p.unit?.name ?? p.template?.unit?.name ?? null,

          // keep legacy fields
          productModel: null,
          productName: p.name ?? null,
        };
      }),
    };

    return res.json(normalized);
  } catch (err) {
    console.error('❌ getPurchaseOrderById error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getPurchaseOrdersBySupplier = async (req, res) => {
  try {
    const supplierId = Number(req.params?.supplierId);
    if (!supplierId) return res.status(400).json({ error: 'Invalid supplierId' });

    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'Unauthorized: Missing branchId' });

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: { branchId, supplierId },
      include: {
        supplier: true,
        items: { include: { product: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(purchaseOrders);
  } catch (err) {
    console.error('❌ getPurchaseOrdersBySupplier error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
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
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'ต้องมีรายการสินค้าอย่างน้อย 1 รายการ' });
    }
    for (const it of items) {
      if (!it?.productId || !it?.quantity || !isMoneyLike(it?.costPrice)) {
        return res.status(400).json({ error: 'รายการสินค้าไม่ถูกต้อง (productId/quantity/costPrice)' });
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
              ...(supplierId ? { supplier: { connect: { id: Number(supplierId) } } } : {}),
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
          for (const item of items) {
            await tx.branchPrice.upsert({
              where: { productId_branchId: { productId: Number(item.productId), branchId } },
              update: { costPrice: D(item.costPrice) },
              create: { productId: Number(item.productId), branchId, costPrice: D(item.costPrice), isActive: true },
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

    if (!createdPO) return res.status(500).json({ error: 'ไม่สามารถสร้างรหัส PO ที่ไม่ซ้ำได้ กรุณาลองใหม่' });
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
    const status = String(req.body?.status || '').trim().toUpperCase();

    if (!id) return res.status(400).json({ error: 'Invalid ID' });
    if (!status) return res.status(400).json({ error: 'INVALID_STATUS' });

    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'Unauthorized: Missing branchId' });

    const exists = await prisma.purchaseOrder.findFirst({ where: { id, branchId } });
    if (!exists) return res.status(404).json({ error: 'Purchase Order not found' });

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status },
      include: {
        supplier: true,
        items: { include: { product: { select: { id: true, name: true } } } },
      },
    });

    return res.json(updated);
  } catch (err) {
    console.error('❌ updatePurchaseOrderStatus error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
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
    // ✅ ไม่บังคับ supplierId
    if (items.length === 0)
      return res.status(400).json({ message: 'ต้องมีรายการสินค้าอย่างน้อย 1 รายการ' });

    // Validate items
    for (const it of items) {
      const qty = Number(it?.quantity);
      const cost = it?.costPrice;
      if (!it?.productId || !qty || qty <= 0 || !isMoneyLike(cost) || Number(cost) <= 0) {
        return res.status(400).json({ message: 'รายการสินค้าไม่ถูกต้อง (productId, quantity>0, costPrice>0)' });
      }
    }

    // ✅ Option A: ขั้นสร้าง PO (Create) ไม่รองรับการใช้/ผูกเงินล่วงหน้า (advancePaymentsUsed)
    // ให้ไปทำในขั้นตอน “จ่ายเงิน/ตัดชำระ Supplier” แยกภายหลังแทน
    if (Array.isArray(advancePaymentsUsed) && advancePaymentsUsed.length > 0) {
      return res.status(400).json({
        message:
          'ขั้นสร้างใบสั่งซื้อ (PO) ไม่รองรับการใช้เงินล่วงหน้า (advancePaymentsUsed) — กรุณาสร้าง PO แบบปกติ และไปผูก/ตัดชำระเงินในขั้นตอนจ่ายเงิน Supplier ภายหลัง',
      });
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
              // ✅ optional supplierId
              supplierId: supplierId ? Number(supplierId) : null,
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

          // upsert branch price
          for (const item of items) {
            await tx.branchPrice.upsert({
              where: { productId_branchId: { productId: Number(item.productId), branchId } },
              update: { costPrice: D(item.costPrice) },
              create: { productId: Number(item.productId), branchId, costPrice: D(item.costPrice), isActive: true },
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

    // ✅ include โยงครบสำหรับ FE
    const out = await prisma.purchaseOrder.findUnique({
      where: { id: createdPOId },
      include: {
        supplier: true,
        items: {
          include: {
            // ✅ safe include: กัน Prisma 500 ถ้า relation chain เปลี่ยน
            product: { select: { id: true, name: true } },
          },
        },
      },
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




































