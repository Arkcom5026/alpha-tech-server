const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ✅ Controller: addReceiptItem - ปลอดภัยและตรวจสอบ receiptId ครบถ้วน
const addReceiptItem = async (req, res) => {
    try {
      const { purchaseOrderReceiptId: receiptId, purchaseOrderItemId, quantity } = req.body;

      console.log('📦 [addReceiptItem] req.body:', req.body);

      if (
        receiptId === undefined ||
        purchaseOrderItemId === undefined ||
        quantity === undefined ||
        receiptId === null ||
        purchaseOrderItemId === null ||
        quantity === null
      ) {
        return res.status(400).json({ error: 'receiptId, purchaseOrderItemId และ quantity เป็นข้อมูลที่จำเป็น' });
      }

      const receipt = await prisma.purchaseOrderReceipt.findUnique({
        where: { id: Number(receiptId) },
      });

      if (!receipt) {
        return res.status(404).json({ error: 'ไม่พบใบรับสินค้าที่ระบุ' });
      }

      const poItem = await prisma.purchaseOrderItem.findUnique({
        where: { id: Number(purchaseOrderItemId) },
        include: { product: true },
      });

      if (!poItem || !poItem.product) {
        return res.status(400).json({ error: 'ไม่พบสินค้าในใบสั่งซื้อหรือสินค้าไม่มีข้อมูล' });
      }

      const costPrice = poItem.product.costPrice || 0;

      const item = await prisma.purchaseOrderReceiptItem.create({
        data: {
          receiptId: Number(receiptId),
          purchaseOrderItemId: Number(purchaseOrderItemId),
          quantity: Number(quantity),
          costPrice,
        },
      });

      return res.status(201).json(item);
    } catch (error) {
      console.error('❌ [addReceiptItem] error:', error);
      return res.status(500).json({ error: 'ไม่สามารถเพิ่มรายการรับสินค้าได้' });
    }
  };


// 🔍 ดึงรายการสินค้าทั้งหมดในใบรับ
const getReceiptItemsByReceiptId = async (req, res) => {
  try {
    console.log('[getReceiptItemsByReceiptId] 🔍req.params >> >> >> ', req.params);
    const receiptId = Number(req.params.receiptId);
    const branchId = req.user.branchId;

    const receipt = await prisma.purchaseOrderReceipt.findFirst({
      where: { id: receiptId, branchId }
    });

    if (!receipt) return res.status(404).json({ error: 'ไม่พบใบรับสินค้านี้ในสาขา' });

    const items = await prisma.purchaseOrderReceiptItem.findMany({
      where: { receiptId: receiptId },
      include: {
        purchaseOrderItem: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                unit: true,
                costPrice: true
              }
            },
            purchaseOrder: {
              select: {
                id: true,
                code: true
              }
            }
          }
        },
        stockItems: true
      }
    });

    return res.json(items);
  } catch (error) {
    console.error('❌ [getReceiptItemsByReceiptId] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถโหลดรายการสินค้าได้' });
  }
};


// 🗑️ ลบรายการสินค้าออกจากใบรับ
const deleteReceiptItem = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const branchId = req.user.branchId;

    const found = await prisma.purchaseOrderReceiptItem.findFirst({
      where: {
        id,
        receipt: { branchId },
      },
    });

    if (!found) return res.status(404).json({ error: 'ไม่พบรายการสินค้านี้ในสาขา' });

    await prisma.purchaseOrderReceiptItem.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error('❌ [deleteReceiptItem] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถลบรายการสินค้าได้' });
  }
};


const getPOItemsByPOId = async (req, res) => {
  try {
    console.log('[getPOItemsByPOId] 🔍req.params >> >> >> ',req.params);

    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Missing PO ID' });

    const items = await prisma.purchaseOrderItem.findMany({
      where: { purchaseOrderId: parseInt(id) },
      include: {
        product: {
          select: { id: true, title: true, costPrice: true, unit: true },
        },
      },
    });

    res.json(items);
  } catch (err) {
    console.error('[getPOItemsByPOId] ❌', err);
    res.status(500).json({ message: 'Server error' });
  }
};


const updateReceiptItem = async (req, res) => {
  try {
    const { purchaseOrderReceiptId: receiptId, purchaseOrderItemId, quantity } = req.body;

    console.log('🔄 [updateReceiptItem] req.body:', req.body);

    if (
      receiptId === undefined ||
      purchaseOrderItemId === undefined ||
      quantity === undefined ||
      receiptId === null ||
      purchaseOrderItemId === null ||
      quantity === null
    ) {
      return res.status(400).json({ error: 'receiptId, purchaseOrderItemId และ quantity เป็นข้อมูลที่จำเป็น' });
    }

    const existingItem = await prisma.purchaseOrderReceiptItem.findFirst({
      where: {
        receiptId: Number(receiptId),
        purchaseOrderItemId: Number(purchaseOrderItemId),
      },
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'ไม่พบรายการที่ต้องการอัปเดต' });
    }

    const updated = await prisma.purchaseOrderReceiptItem.update({
      where: { id: existingItem.id },
      data: { quantity: Number(quantity) },
    });

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
  updateReceiptItem
};    
