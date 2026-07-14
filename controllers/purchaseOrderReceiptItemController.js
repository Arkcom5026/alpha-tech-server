


// purchaseOrderReceiptItemController — Prisma singleton, branch-scope enforced, Decimal-safe

const { Prisma } = require('@prisma/client');
const { prisma } = require('../lib/prisma');

const D = (v) => {
  // Decimal-safe coercion (accept number|string|Decimal)
  if (v instanceof Prisma.Decimal) return v;
  if (v === undefined || v === null || v === '') return new Prisma.Decimal(0);
  return new Prisma.Decimal(typeof v === 'string' ? v : String(v));
};
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : parseInt(String(v), 10));
const toNum = (v) => (v === undefined || v === null || v === '' ? NaN : Number(v));

// POST /purchase-order-receipt-items
const addReceiptItem = async (req, res) => {
  try {
    const receiptId = toInt(req.body?.purchaseOrderReceiptId || req.body?.receiptId);
    const purchaseOrderItemId = toInt(req.body?.purchaseOrderItemId);
    const quantity = toNum(req.body?.quantity);
    const costPrice = req.body?.costPrice;
    const forceAccept = !!req.body?.forceAccept; // ✅ allow over-receive only when explicitly confirmed by user
    

    console.log('📦 [addReceiptItem] req.body:', req.body);

    if (!req.user?.branchId) return res.status(401).json({ error: 'unauthorized' });

    if (!receiptId || !purchaseOrderItemId || Number.isNaN(quantity) || quantity <= 0 || costPrice === undefined || costPrice === null) {
      return res.status(400).json({ error: 'receiptId, purchaseOrderItemId, quantity และ costPrice เป็นข้อมูลที่จำเป็น' });
    }

    const receipt = await prisma.purchaseOrderReceipt.findFirst({
      where: { id: receiptId, branchId: req.user.branchId }, // ✅ BRANCH_SCOPE_ENFORCED
      include: { purchaseOrder: true },
    });
    if (!receipt) return res.status(404).json({ error: 'ไม่พบใบรับสินค้านี้ในสาขา' });

    // ✅ Guard: once receipt completed/locked, do not allow edits
    if (String(receipt.statusReceipt || '').toUpperCase() === 'COMPLETED') {
      return res.status(409).json({ error: 'ใบรับสินค้าถูกปิดแล้ว ไม่สามารถแก้ไขรายการได้' });
    }

    const poItem = await prisma.purchaseOrderItem.findUnique({
      where: { id: purchaseOrderItemId },
      include: { product: true, purchaseOrder: true },
    });
    if (!poItem || !poItem.product) {
      return res.status(400).json({ error: 'ไม่พบสินค้าในใบสั่งซื้อหรือสินค้าไม่มีข้อมูล' });
    }

    // ✅ Prevent cross-PO injection: receipt must accept items only from its own PO
    if (receipt.purchaseOrderId && poItem.purchaseOrderId && Number(receipt.purchaseOrderId) !== Number(poItem.purchaseOrderId)) {
      return res.status(400).json({ error: 'รายการนี้ไม่ใช่ของใบสั่งซื้อเดียวกับใบรับสินค้า' });
    }

    // ✅ Upsert-like behavior by (receiptId, purchaseOrderItemId)
    const existingItem = await prisma.purchaseOrderReceiptItem.findFirst({
      where: { receiptId, purchaseOrderItemId, receipt: { branchId: receipt.branchId } },
      include: { stockItems: true },
    });
    if (existingItem?.stockItems?.length) {
      return res.status(409).json({ error: 'อัปเดตไม่ได้: มีการยิง SN เข้าสต๊อกแล้ว' });
    }

    // (ออปชัน) ป้องกันรับเกินจากใบสั่งซื้อ: ตรวจรวม quantity ที่รับแล้ว (ยกเว้นรายการนี้) + quantity ใหม่
    const agg = await prisma.purchaseOrderReceiptItem.aggregate({
      where: {
        purchaseOrderItemId,
        receipt: { branchId: receipt.branchId },
        ...(existingItem ? { NOT: { id: existingItem.id } } : {}),
      },
      _sum: { quantity: true },
    });
    const sumQty = agg?._sum?.quantity ?? new Prisma.Decimal(0);
    const alreadyQty = sumQty instanceof Prisma.Decimal ? sumQty.toNumber() : Number(sumQty || 0);
    const poQty = poItem?.quantity instanceof Prisma.Decimal ? poItem.quantity.toNumber() : Number(poItem?.quantity || 0);

    // ✅ Business rule: allow over-receive ONLY when user explicitly confirms (forceAccept=true)
    if (poQty && (alreadyQty + quantity > poQty + 1e-6)) {
      if (!forceAccept) {
        return res.status(400).json({ error: 'จำนวนที่รับรวมเกินจากจำนวนในใบสั่งซื้อ' });
      }
      // Defensive logging (no DB change): keep a trace for auditing
      console.warn('[addReceiptItem] forceAccept over-receive', {
        receiptId,
        purchaseOrderItemId,
        poQty,
        alreadyQty,
        incomingQty: quantity,
        overBy: (alreadyQty + quantity) - poQty,
        branchId: receipt?.branchId,
        userId: req.user?.id,
        employeeId: req.user?.employeeId,
      });
    }

    const saved = await prisma.$transaction(async (tx) => {
      // Create or update receipt item
      const item = existingItem
        ? await tx.purchaseOrderReceiptItem.update({
            where: { id: existingItem.id },
            data: { quantity, costPrice: D(costPrice) },
          })
        : await tx.purchaseOrderReceiptItem.create({
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

    return res.status(existingItem ? 200 : 201).json(saved);
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
    const branchId = req.user?.branchId;

    if (!branchId) return res.status(401).json({ error: 'unauthorized' });
    if (!receiptId) return res.status(400).json({ error: 'Missing or invalid receiptId' });

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
    const branchId = req.user?.branchId;

    if (!branchId) return res.status(401).json({ error: 'unauthorized' });
    if (!id) return res.status(400).json({ error: 'Missing or invalid id' });

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
    return res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /purchase-order-receipt-items
const updateReceiptItem = async (req, res) => {
  try {
    const receiptId = toInt(req.body?.purchaseOrderReceiptId || req.body?.receiptId);
    const purchaseOrderItemId = toInt(req.body?.purchaseOrderItemId);
    const quantity = toNum(req.body?.quantity);
    const costPrice = req.body?.costPrice;
    const forceAccept = !!req.body?.forceAccept;

    console.log('🔄 [updateReceiptItem] req.body:', req.body);

    if (!req.user?.branchId) return res.status(401).json({ error: 'unauthorized' });

    if (!receiptId || !purchaseOrderItemId || Number.isNaN(quantity) || quantity <= 0 || costPrice === undefined || costPrice === null) {
      return res.status(400).json({ error: 'receiptId, purchaseOrderItemId, quantity และ costPrice เป็นข้อมูลที่จำเป็น' });
    }

    const existingItem = await prisma.purchaseOrderReceiptItem.findFirst({
      where: { receiptId, purchaseOrderItemId, receipt: { branchId: req.user.branchId } },
      include: {
        receipt: true,
        purchaseOrderItem: { include: { purchaseOrder: true } },
        stockItems: true,
      },
    });

    if (!existingItem) return res.status(404).json({ error: 'ไม่พบรายการที่ต้องการอัปเดต' });
    if (String(existingItem.receipt?.statusReceipt || '').toUpperCase() === 'COMPLETED') {
      return res.status(409).json({ error: 'ใบรับสินค้าถูกปิดแล้ว ไม่สามารถแก้ไขรายการได้' });
    }
    if (existingItem.stockItems && existingItem.stockItems.length > 0) {
      return res.status(409).json({ error: 'อัปเดตไม่ได้: มีการยิง SN เข้าสต๊อกแล้ว' });
    }

    // (ออปชัน) ป้องกันรับเกินจากใบสั่งซื้อ: ตรวจรวม quantity ที่รับแล้ว (ยกเว้นรายการนี้) + quantity ใหม่
    const poQty2 = existingItem?.purchaseOrderItem?.quantity instanceof Prisma.Decimal
      ? existingItem.purchaseOrderItem.quantity.toNumber()
      : Number(existingItem?.purchaseOrderItem?.quantity || 0);

    if (poQty2) {
      const agg = await prisma.purchaseOrderReceiptItem.aggregate({
        where: {
          purchaseOrderItemId,
          receipt: { branchId: existingItem.receipt.branchId },
          NOT: { id: existingItem.id },
        },
        _sum: { quantity: true },
      });
      const sumQty2 = agg?._sum?.quantity ?? new Prisma.Decimal(0);
      const already = sumQty2 instanceof Prisma.Decimal ? sumQty2.toNumber() : Number(sumQty2 || 0);
      if (already + quantity > poQty2 + 1e-6) {
        if (!forceAccept) {
          return res.status(400).json({ error: 'จำนวนที่รับรวมเกินจากจำนวนในใบสั่งซื้อ' });
        }
        console.warn('[updateReceiptItem] forceAccept over-receive', {
          receiptId,
          purchaseOrderItemId,
          poQty: poQty2,
          alreadyQty: already,
          incomingQty: quantity,
          overBy: (already + quantity) - poQty2,
          branchId: existingItem?.receipt?.branchId,
          userId: req.user?.id,
          employeeId: req.user?.employeeId,
        });
      }
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









