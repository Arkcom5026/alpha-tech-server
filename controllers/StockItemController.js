const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// POST /api/stock-items
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

// GET /api/stock-items/by-receipt/:receiptId
const getStockItemsByReceipt = async (req, res) => {
  try {
    const { receiptId } = req.params;

    const items = await prisma.stockItem.findMany({
      where: {
        purchaseOrderReceiptItem: {
          receiptId: Number(receiptId)
        }
      },
      include: {
        product: true,
        purchaseOrderReceiptItem: {
          include: {
            receipt: {
              include: {
                purchaseOrder: { select: { code: true } },
                supplier: { select: { name: true } }
              }
            }
          }
        }
      }
    });

    res.json(items);
  } catch (error) {
    console.error('[getStockItemsByReceipt]', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/stock-items/by-product/:productId
const getStockItemsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const items = await prisma.stockItem.findMany({
      where: { productId: Number(productId) },
      include: { product: true },
      orderBy: { id: 'asc' }
    });
    res.json(items);
  } catch (error) {
    console.error('[getStockItemsByProduct]', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/stock-items/for-barcode-print
const getStockItemsForBarcodePrint = async (req, res) => {
  try {

    
    const items = await prisma.stockItem.findMany({
      where: {
        purchaseOrderReceiptItemId: { not: null },
        status: 'IN_STOCK'
      },
      orderBy: { id: 'asc' },
      include: {
        product: true,
        purchaseOrderReceiptItem: {
          include: {
            receipt: {
              include: {
                purchaseOrder: {
                  include: { supplier: true }
                }
              }
            }
          }
        }
      }
    });

    res.json(items);
    console.log('[getStockItemsForBarcodePrint] Fetching stock items for barcode print : ', items);

  } catch (error) {
    console.error('[getStockItemsForBarcodePrint]', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /api/stock-items/:id
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

// PATCH /api/stock-items/:id/status
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
  getStockItemsByReceipt,
  getStockItemsByProduct,
  deleteStockItem,
  updateStockItemStatus,
  getStockItemsForBarcodePrint
};
