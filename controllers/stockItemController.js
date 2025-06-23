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
        warrantyDays,
        expiredAt,
        remark,
        locationCode,
        source,
        tag,
        batchNumber,
        checkedBy
      } = req.body;

      if (!receiptItemId || !productId || !branchId || !barcode ) {
        return res.status(400).json({ message: 'Missing required fields' });
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

  // ✅ PATCH /api/stock-items/mark-sold/:saleId
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

      // ✅ Update barcode -> link to stockItem
      await prisma.barcodeReceiptItem.update({
        where: { barcode },
        data: { stockItemId: newStockItem.id },
      });

      // ✅ หักเครดิตจาก supplier ทันที
      await prisma.supplier.update({
        where: { id: purchaseOrder.supplierId },
        data: {
          creditBalance: {

          },
        },
      });

      return res.status(201).json({ message: '✅ รับสินค้าเข้าสต๊อกเรียบร้อยแล้ว', stockItem: newStockItem });
    } catch (error) {
      console.error('[receiveStockItem] ❌ Unexpected error:', error);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  };

  // ✅ GET /stock-items/search?query=xxx
  const searchStockItem = async (req, res) => {
    try {
      const query = req.query.query || req.query.barcode;
      if (!query) return res.status(400).json({ error: 'Missing query or barcode' });

      const items = await prisma.stockItem.findMany({
        where: {
          status: 'IN_STOCK',
          OR: [
            { barcode: { equals: query } },
            { product: { is: { name: { contains: query, mode: 'insensitive' } } } },
          ]
        },
        include: {
          product: true
        },
        orderBy: { id: 'asc' }
      });

      return res.json(items);
    } catch (err) {
      console.error('❌ [searchStockItem] error:', err);
      return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาสินค้า' });
    }
  };

  // ✅ PATCH /api/stock-items/update-sn/:barcode
  const updateSerialNumber = async (req, res) => {
    try {
      const { barcode } = req.params;
      const { serialNumber } = req.body;

      if (!barcode) {
        return res.status(400).json({ error: 'Missing barcode.' });
      }

      // หา stockItem ที่ตรงกับ barcode
      const stockItem = await prisma.stockItem.findUnique({
        where: { barcode },
      });

      if (!stockItem) {
        return res.status(404).json({ error: 'Stock item not found.' });
      }

      // ✅ ตรวจ SN ซ้ำก่อนบันทึก
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
  };
