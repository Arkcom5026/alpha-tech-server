// ✅ StockItemController.js — จัดการ SN และรายการสินค้าเข้าสต๊อก
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ✅ POST /api/stock-items
const addStockItemFromReceipt = async (req, res) => {
  try {
    const {
      receiptItemId,
      productId,
      branchId,
      barcode,
      serialNumber,
      qrCodeData,
      buyPrice,
      sellPrice,
      warrantyDays,
      expiredAt,
      remark,
      locationCode,
      source,
      tag,
      batchNumber,
      checkedBy
    } = req.body;

    if (!receiptItemId || !productId || !branchId || !barcode || !buyPrice) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const newItem = await prisma.stockItem.create({
      data: {
        barcode,
        serialNumber,
        qrCodeData,
        buyPrice,
        sellPrice,
        warrantyDays,
        expiredAt: expiredAt ? new Date(expiredAt) : null,
        remark,
        locationCode,
        source: source || 'PURCHASE_ORDER',
        tag,
        batchNumber,
        checkedBy,
        product: { connect: { id: productId } },
        branch: { connect: { id: branchId } },
        purchaseOrderReceiptItem: { connect: { id: receiptItemId } }
      }
    });

    res.status(201).json(newItem);
  } catch (error) {
    console.error('[addStockItemFromReceipt]', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ✅ POST /api/stock-items/receive-sn
const receiveStockItem = async (req, res) => {
  try {
    const { barcode, receiptItemId } = req.body;

    if (!barcode || !receiptItemId) {
      return res.status(400).json({ error: 'barcode และ receiptItemId จำเป็นต้องมี' });
    }

    const receiptItem = await prisma.purchaseOrderReceiptItem.findUnique({
      where: { id: receiptItemId },
      include: { stockItems: true },
    });

    if (!receiptItem) {
      return res.status(404).json({ error: 'ไม่พบ receipt item นี้' });
    }

    const exists = await prisma.stockItem.findUnique({ where: { barcode } });
    if (exists) {
      return res.status(409).json({ error: 'บาร์โค้ดนี้มีอยู่แล้วในระบบ' });
    }

    if (receiptItem.stockItems.length >= receiptItem.quantity) {
      return res.status(400).json({ error: 'จำนวน SN ครบแล้ว' });
    }

    const newItem = await prisma.stockItem.create({
      data: {
        barcode,
        receiptItem: { connect: { id: receiptItemId } },
        status: 'IN_STOCK',
      },
    });

    return res.json(newItem);
  } catch (err) {
    console.error('[receiveStockItem]', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
};

// ✅ GET /api/stock-items/by-receipt/:receiptId
const getStockItemsByReceipt = async (req, res) => {
  try {
    const { receiptId } = req.params;

    const receiptItems = await prisma.purchaseOrderReceiptItem.findMany({
      where: { receiptId: Number(receiptId) },
      include: {
        product: true,
        purchaseOrderItem: {
          include: {
            product: true
          }
        }
      },
      orderBy: { id: 'asc' }
    });

    res.json(receiptItems);
  } catch (error) {
    console.error('[getStockItemsByReceipt]', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ✅ POST /api/stock-items/by-receipt-ids
const getStockItemsByReceiptIds = async (req, res) => {
  try {
    const { receiptIds } = req.body;

    if (!Array.isArray(receiptIds) || receiptIds.length === 0) {
      return res.status(400).json({ message: 'receiptIds ต้องเป็น array ที่ไม่ว่าง' });
    }

    const receiptItems = await prisma.purchaseOrderReceiptItem.findMany({
      where: { receiptId: { in: receiptIds.map(Number) } },
      include: {
        product: true,
        purchaseOrderItem: {
          include: {
            product: true
          }
        },
        receipt: {
          include: {
            purchaseOrder: {
              include: { supplier: true }
            }
          }
        }
      },
      orderBy: { id: 'asc' }
    });

    res.json(receiptItems);
  } catch (error) {
    console.error('[getStockItemsByReceiptIds]', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ✅ DELETE /api/stock-items/:id
const deleteStockItem = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await prisma.stockItem.delete({ where: { id: Number(id) } });
    res.json(deleted);
  } catch (error) {
    console.error('[deleteStockItem]', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ✅ PATCH /api/stock-items/:id/status
const updateStockItemStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await prisma.stockItem.update({
      where: { id: Number(id) },
      data: { status }
    });
    res.json(updated);
  } catch (error) {
    console.error('[updateStockItemStatus]', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  addStockItemFromReceipt,
  receiveStockItem,
  getStockItemsByReceipt,
  getStockItemsByReceiptIds,
  deleteStockItem,
  updateStockItemStatus
};
