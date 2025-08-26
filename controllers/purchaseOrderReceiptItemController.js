// purchaseOrderReceiptItemController — Prisma singleton, branch-scope enforced, Decimal-safe

const { prisma, Prisma } = require('../lib/prisma');

const D = (v) => (v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v ?? 0));
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : parseInt(v, 10));

// POST /purchase-order-receipt-items
const addReceiptItem = async (req, res) => {
  try {
    const receiptId = toInt(req.body?.purchaseOrderReceiptId || req.body?.receiptId);
    const purchaseOrderItemId = toInt(req.body?.purchaseOrderItemId);
    const quantity = Number(req.body?.quantity);
    const costPrice = req.body?.costPrice;

    console.log('📦 [addReceiptItem] req.body:', req.body);

    if (!receiptId || !purchaseOrderItemId || Number.isNaN(quantity) || costPrice === undefined || costPrice === null) {
      return res.status(400).json({ error: 'receiptId, purchaseOrderItemId, quantity และ costPrice เป็นข้อมูลที่จำเป็น' });
    }

    const receipt = await prisma.purchaseOrderReceipt.findFirst({
      where: { id: receiptId, branchId: req.user.branchId }, // ✅ BRANCH_SCOPE_ENFORCED
      include: { purchaseOrder: true },
    });
    if (!receipt) return res.status(404).json({ error: 'ไม่พบใบรับสินค้านี้ในสาขา' });

    const poItem = await prisma.purchaseOrderItem.findUnique({
      where: { id: purchaseOrderItemId },
      include: { product: true, purchaseOrder: true },
    });
    if (!poItem || !poItem.product) {
      return res.status(400).json({ error: 'ไม่พบสินค้าในใบสั่งซื้อหรือสินค้าไม่มีข้อมูล' });
    }

    // (ออปชัน) ป้องกันรับเกินจากใบสั่งซื้อ: ตรวจรวม quantity ที่รับแล้วกับที่จะเพิ่ม
    const alreadyQtyDec = await prisma.purchaseOrderReceiptItem.aggregate({
      where: { purchaseOrderItemId },
      _sum: { quantity: true },
    });
    const alreadyQty = Number(alreadyQtyDec?._sum?.quantity || 0);
    if (poItem.quantity && alreadyQty + quantity > poItem.quantity + 1e-6) {
      return res.status(400).json({ error: 'จำนวนที่รับรวมเกินจากจำนวนในใบสั่งซื้อ' });
    }

    const created = await prisma.$transaction(async (tx) => {
      const item = await tx.purchaseOrderReceiptItem.create({
        data: {
          receiptId,
          purchaseOrderItemId,
          quantity,
          costPrice: D(costPrice), // ✅ Decimal-safe
        },
      });

      // ✅ อัปเดตราคาทุนล่าสุดของสาขา (upsert โดยใช้คีย์ผสม productId+branchId)
      await tx.branchPrice.upsert({
        where: {
          productId_branchId: {
            productId: poItem.productId,
            branchId: receipt.branchId,
          },
        },
        update: { costPrice: D(costPrice) },
        create: {
          productId: poItem.productId,
          branchId: receipt.branchId,
          costPrice: D(costPrice),
        },
      });

      return item;
    }, { timeout: 15000 });

    return res.status(201).json(created);
  } catch (error) {
    console.error('❌ [addReceiptItem] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถเพิ่มรายการรับสินค้าได้' });
  }
};

// GET /purchase-order-receipt-items/receipt/:receiptId
const getReceiptItemsByReceiptId = async (req, res) => {
  try {
    console.log('[getReceiptItemsByReceiptId] 🔍req.params >>', req.params);
    const receiptId = toInt(req.params.receiptId);
    const branchId = req.user.branchId;

    const receipt = await prisma.purchaseOrderReceipt.findFirst({ where: { id: receiptId, branchId } });
    if (!receipt) return res.status(404).json({ error: 'ไม่พบใบรับสินค้านี้ในสาขา' });

    const items = await prisma.purchaseOrderReceiptItem.findMany({
      where: { receiptId },
      include: {
        purchaseOrderItem: {
          include: {
            product: { select: { id: true, name: true, unit: true } },
            purchaseOrder: { select: { id: true, code: true } },
          },
        },
        stockItems: true,
      },
      orderBy: [{ id: 'asc' }],
    });

    return res.json(items);
  } catch (error) {
    console.error('❌ [getReceiptItemsByReceiptId] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถโหลดรายการสินค้าได้' });
  }
};

// DELETE /purchase-order-receipt-items/:id
const deleteReceiptItem = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    const branchId = req.user.branchId;

    const found = await prisma.purchaseOrderReceiptItem.findFirst({
      where: { id, receipt: { branchId } },
      include: { stockItems: true },
    });

    if (!found) return res.status(404).json({ error: 'ไม่พบรายการสินค้านี้ในสาขา' });
    if (found.stockItems && found.stockItems.length > 0) {
      return res.status(409).json({ error: 'ลบไม่ได้: มีการยิง SN เข้าสต๊อกแล้ว' });
    }

    await prisma.purchaseOrderReceiptItem.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error('❌ [deleteReceiptItem] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถลบรายการสินค้าได้' });
  }
};

// GET /purchase-order-items/po/:id
const getPOItemsByPOId = async (req, res) => {
  try {
    console.log('[getPOItemsByPOId] 🔍req.params >>', req.params);

    const poId = toInt(req.params.id);
    if (!poId) return res.status(400).json({ message: 'Missing PO ID' });

    const items = await prisma.purchaseOrderItem.findMany({
      where: { purchaseOrderId: poId, purchaseOrder: { branchId: req.user.branchId } }, // ✅ BRANCH_SCOPE
      include: { product: { select: { id: true, name: true, unit: true } } },
      orderBy: [{ id: 'asc' }],
    });

    res.json(items);
  } catch (err) {
    console.error('[getPOItemsByPOId] ❌', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /purchase-order-receipt-items
const updateReceiptItem = async (req, res) => {
  try {
    const receiptId = toInt(req.body?.purchaseOrderReceiptId || req.body?.receiptId);
    const purchaseOrderItemId = toInt(req.body?.purchaseOrderItemId);
    const quantity = Number(req.body?.quantity);
    const costPrice = req.body?.costPrice;

    console.log('🔄 [updateReceiptItem] req.body:', req.body);

    if (!receiptId || !purchaseOrderItemId || Number.isNaN(quantity) || costPrice === undefined || costPrice === null) {
      return res.status(400).json({ error: 'receiptId, purchaseOrderItemId, quantity และ costPrice เป็นข้อมูลที่จำเป็น' });
    }

    const existingItem = await prisma.purchaseOrderReceiptItem.findFirst({
      where: { receiptId, purchaseOrderItemId, receipt: { branchId: req.user.branchId } },
      include: { receipt: true, purchaseOrderItem: true, stockItems: true },
    });

    if (!existingItem) return res.status(404).json({ error: 'ไม่พบรายการที่ต้องการอัปเดต' });
    if (existingItem.stockItems && existingItem.stockItems.length > 0) {
      return res.status(409).json({ error: 'อัปเดตไม่ได้: มีการยิง SN เข้าสต๊อกแล้ว' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const upd = await tx.purchaseOrderReceiptItem.update({
        where: { id: existingItem.id },
        data: { quantity, costPrice: D(costPrice) }, // ✅ Decimal-safe
      });

      await tx.branchPrice.upsert({
        where: {
          productId_branchId: {
            productId: existingItem.purchaseOrderItem.productId,
            branchId: existingItem.receipt.branchId,
          },
        },
        update: { costPrice: D(costPrice) },
        create: {
          productId: existingItem.purchaseOrderItem.productId,
          branchId: existingItem.receipt.branchId,
          costPrice: D(costPrice),
        },
      });

      return upd;
    }, { timeout: 15000 });

    return res.json(updated);
  } catch (error) {
    console.error('❌ [updateReceiptItem] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถอัปเดตรายการสินค้าได้' });
  }
};

module.exports = {
  addReceiptItem,
  getReceiptItemsByReceiptId,
  deleteReceiptItem,
  getPOItemsByPOId,
  updateReceiptItem,
};