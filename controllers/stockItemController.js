// ✅ StockItemController.js — จัดการ SN และรายการสินค้าเข้าสต๊อก
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const addStockItemFromReceipt = async (req, res) => {
  try {
    const {
      receiptItemId,
      productId,
      branchId,
      barcode,
      serialNumber,
      qrCodeData,
      warrantyDays,
      expiredAt,
      remark,
      locationCode,
      source,
      tag,
      batchNumber,
      checkedBy
    } = req.body;

    if (!receiptItemId || !productId || !branchId || !barcode) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const exists = await prisma.stockItem.findUnique({ where: { barcode } });
    if (exists) {
      return res.status(400).json({ message: 'Barcode นี้ถูกใช้แล้ว' });
    }

    const newItem = await prisma.stockItem.create({
      data: {
        barcode,
        serialNumber,
        qrCodeData,
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

const updateStockItemStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatus = ['IN_STOCK', 'SOLD', 'CLAIMED', 'LOST'];
    if (!validStatus.includes(status)) {
      return res.status(400).json({ message: 'สถานะไม่ถูกต้อง' });
    }

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

const markStockItemsAsSold = async (req, res) => {
  try {
    const { stockItemIds } = req.body;
    console.log('req.body : ', req.body);
    if (!Array.isArray(stockItemIds) || stockItemIds.length === 0) {
      return res.status(400).json({ message: 'stockItemIds ต้องเป็น array' });
    }

    const updated = await prisma.stockItem.updateMany({
      where: {
        id: { in: stockItemIds },
        status: 'IN_STOCK',
      },
      data: {
        status: 'SOLD',
        soldAt: new Date(),
      },
    });

    return res.status(200).json({ count: updated.count });
  } catch (err) {
    console.error('❌ markStockItemsAsSold error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

const receiveStockItem = async (req, res) => {
  try {
    const { barcode: barcodeData } = req.body;

    if (!barcodeData || typeof barcodeData !== 'object') {
      return res.status(400).json({ error: 'Invalid barcode payload.' });
    }

    const { barcode, serialNumber, keepSN } = barcodeData;

    if (!barcode || typeof barcode !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid barcode.' });
    }

    const barcodeItem = await prisma.barcodeReceiptItem.findUnique({
      where: { barcode },
      include: {
        receiptItem: {
          include: {
            receipt: true,
            purchaseOrderItem: {
              include: {
                product: true,
                purchaseOrder: true
              }
            }
          }
        }
      }
    });

    if (!barcodeItem) {
      return res.status(404).json({ error: 'Barcode not found.' });
    }

    if (barcodeItem.stockItemId) {
      return res.status(400).json({ error: 'This barcode has already been received.' });
    }

    const product = barcodeItem.receiptItem?.purchaseOrderItem?.product;
    const purchaseOrder = barcodeItem.receiptItem?.purchaseOrderItem?.purchaseOrder;
    if (!product || !purchaseOrder) {
      return res.status(400).json({ error: 'Product or PO data missing.' });
    }

    const branchId = barcodeItem.receiptItem.receipt?.branchId;
    if (!branchId) {
      return res.status(400).json({ error: 'Branch not found for this barcode.' });
    }

    const newStockItem = await prisma.stockItem.create({
      data: {
        barcode,
        serialNumber: serialNumber || barcode,
        status: 'IN_STOCK',
        receivedAt: new Date(),
        product: { connect: { id: product.id } },
        branch: { connect: { id: branchId } },
        purchaseOrderReceiptItem: { connect: { id: barcodeItem.receiptItem.id } }
      },
    });

    await prisma.barcodeReceiptItem.update({
      where: { barcode },
      data: { stockItemId: newStockItem.id },
    });

    const quantity = 1; // แก้ให้ถูกต้อง: 1 barcode = 1 ชิ้น
    const costPrice = barcodeItem.receiptItem.costPrice || 0;
    const totalCost = quantity * costPrice;

    if (totalCost > 0) {
      await prisma.supplier.update({
        where: { id: purchaseOrder.supplierId },
        data: {
          creditBalance: {
            increment: totalCost
          },
        },
      });
    }

    return res.status(201).json({ message: '✅ รับสินค้าเข้าสต๊อกเรียบร้อยแล้ว', stockItem: newStockItem });
  } catch (error) {
    console.error('[receiveStockItem] ❌ Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

const searchStockItem = async (req, res) => {
  try {
    const query = req.query.query || req.query.barcode;
    const branchId = req.user?.branchId;
    if (!query || !branchId) {
      return res.status(400).json({ error: 'Missing query or branchId' });
    }

    const stockItems = await prisma.stockItem.findMany({
      where: {
        status: 'IN_STOCK',
        branchId,
        OR: [
          { barcode: { equals: query } },
          { serialNumber: { equals: query } },
          { product: { is: { name: { contains: query, mode: 'insensitive' } } } },
          { product: { is: { model: { contains: query, mode: 'insensitive' } } } },
        ],
      },
      include: {
        product: true,
      },
      orderBy: { id: 'asc' },
      take: 20,
    });

    // เพิ่มราคาขายจาก BranchPrice ให้แต่ละรายการ
    const result = await Promise.all(
      stockItems.map(async (item) => {
        const branchPrice = await prisma.branchPrice.findFirst({
          where: {
            branchId,
            productId: item.productId,
          },
          select: {
            priceRetail: true,
            priceWholesale: true,
            priceTechnician: true,
            priceOnline: true,
          },
        });

        return {
          ...item,
          prices: {
            retail: branchPrice?.priceRetail || 0,
            wholesale: branchPrice?.priceWholesale || 0,
            technician: branchPrice?.priceTechnician || 0,
            online: branchPrice?.priceOnline || 0,
          },
        };
      })
    );

    return res.json(result);
  } catch (err) {
    console.error('❌ [searchStockItem] error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาสินค้า' });
  }
};


const updateSerialNumber = async (req, res) => {
  try {
    const { barcode } = req.params;
    const { serialNumber } = req.body;

    if (!barcode) {
      return res.status(400).json({ error: 'Missing barcode.' });
    }

    const stockItem = await prisma.stockItem.findUnique({
      where: { barcode },
    });

    if (!stockItem) {
      return res.status(404).json({ error: 'Stock item not found.' });
    }

    if (serialNumber) {
      const duplicate = await prisma.stockItem.findFirst({
        where: {
          serialNumber,
          NOT: { id: stockItem.id },
        },
      });

      if (duplicate) {
        return res.status(400).json({ error: 'SN นี้ถูกใช้ไปแล้วกับสินค้ารายการอื่น' });
      }
    }

    const updated = await prisma.stockItem.update({
      where: { id: stockItem.id },
      data: {
        serialNumber: serialNumber || null,
      },
      include: {
        purchaseOrderReceiptItem: {
          select: {
            receiptId: true,
          },
        },
      },
    });

    res.json({ message: 'SN updated', stockItem: updated });
  } catch (error) {
    console.error('[updateSerialNumber] ❌ Error:', error);
    res.status(500).json({ error: 'Failed to update serial number.' });
  }
};


const getAvailableStockItemsByProduct = async (req, res) => {
  try {
    const { productId } = req.query;
    const branchId = req.user?.branchId;
    console.log('---------------------------------------------------------------------------------- getAvailableStockItemsByProduct ');

    if (!productId || !branchId) {
      return res.status(400).json({ error: 'ต้องระบุ productId และอยู่ภายใต้ branch ที่ล็อกอิน' });
    }

    const items = await prisma.stockItem.findMany({
      where: {
        productId: Number(productId),
        branchId: Number(branchId),
        status: 'IN_STOCK',
      },
      orderBy: {
        receivedAt: 'asc',
      },
      select: {
        id: true,
        barcode: true,
        serialNumber: true,
        productId: true,
        costPrice: true,
        receivedAt: true,
        product: {
          select: {
            name: true,
            model: true,
            brand: true,
            code: true,
            barcode: true,
            productProfile: {
              select: {
                name: true,
              },
            },
            productType: {
              select: {
                name: true,
              },
            },
            category: {
              select: {
                name: true,
              },
            },
            unit: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return res.json(items);
  } catch (error) {
    console.error('[getAvailableStockItemsByProduct]', error);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการโหลด stock item' });
  }
};



module.exports = {
  addStockItemFromReceipt,
  receiveStockItem,
  getStockItemsByReceipt,
  getStockItemsByReceiptIds,
  deleteStockItem,
  updateStockItemStatus,
  searchStockItem,
  markStockItemsAsSold,
  updateSerialNumber,
  getAvailableStockItemsByProduct,
};
