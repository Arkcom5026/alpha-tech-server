// src/controllers/barcodeController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dayjs = require('dayjs');

const generateMissingBarcodes = async (req, res) => {
  const { receiptId } = req.params;
  const userBranchId = req.user?.branchId;

  if (!receiptId || !userBranchId) {
    return res.status(400).json({ error: 'Missing receiptId or branchId' });
  }

  try {
    const receipt = await prisma.purchaseOrderReceipt.findUnique({
      where: { id: Number(receiptId) },
      include: {
        purchaseOrder: {
          include: { branch: true },
        },
        items: {
          include: {
            purchaseOrderItem: true,
            barcodeReceiptItem: true,
          },
        },
      },
    });

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    if (receipt.purchaseOrder.branchId !== userBranchId) {
      return res.status(403).json({ error: 'Permission denied for this receipt' });
    }

    const branchId = receipt.purchaseOrder.branchId;
    const yearMonth = dayjs().format('YYMM');

    let counter = await prisma.barcodeCounter.upsert({
      where: {
        branchId_yearMonth: {
          branchId,
          yearMonth,
        },
      },
      update: {},
      create: {
        branchId,
        yearMonth,
        lastNumber: 0,
      },
    });

    const newBarcodes = [];

    for (const item of receipt.items) {
      const existingCount = item.barcodeReceiptItem.length;
      const missingCount = item.quantity - existingCount;

      if (missingCount <= 0) continue;

      for (let i = 0; i < missingCount; i++) {
        counter.lastNumber += 1;
        const padded = String(counter.lastNumber).padStart(4, '0');
        const code = `${String(branchId).padStart(2, '0')}${yearMonth}${padded}`;

        newBarcodes.push({
          barcode: code,
          branchId,
          yearMonth,
          runningNumber: counter.lastNumber,
          status: 'READY',
          printed: false,
          purchaseOrderReceiptId: receipt.id,
          receiptItemId: item.id,
        });
      }
    }

    if (newBarcodes.length > 0) {
      await prisma.barcodeReceiptItem.createMany({ data: newBarcodes });
      await prisma.barcodeCounter.update({
        where: {
          branchId_yearMonth: {
            branchId,
            yearMonth,
          },
        },
        data: {
          lastNumber: counter.lastNumber,
        },
      });
    }

    return res.status(200).json({
      success: true,
      createdCount: newBarcodes.length,
      barcodes: newBarcodes,
    });
  } catch (error) {
    console.error('[generateMissingBarcodes] ❌', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getBarcodesByReceiptId = async (req, res) => {
  const { receiptId } = req.params;
  const branchId = req.user?.branchId;

  if (!receiptId || !branchId) {
    return res.status(400).json({ error: 'Missing receiptId or branchId' });
  }

  try {
    const barcodes = await prisma.barcodeReceiptItem.findMany({
      where: {
        purchaseOrderReceiptId: Number(receiptId),
        branchId: Number(branchId),
      },
      include: {
        stockItem: true,
        receiptItem: {
          include: {
            purchaseOrderItem: {
              include: {
                product: {
                  select: {
                    title: true,
                    spec: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    const simplified = barcodes.map((b) => ({
      id: b.id,
      barcode: b.barcode,
      stockItemId: b.stockItemId || null,
      serialNumber: b.stockItem?.serialNumber || null,
      product: {
        title: b.receiptItem?.purchaseOrderItem?.product?.title || '',
        spec: b.receiptItem?.purchaseOrderItem?.product?.spec || '',
      },
    }));

    return res.status(200).json({
      success: true,
      count: simplified.length,
      barcodes: simplified,
    });
  } catch (error) {
    console.error('[getBarcodesByReceiptId] ❌', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const getReceiptsWithBarcodes = async (req, res) => {
  const branchId = req.user?.branchId;

  if (!branchId) {
    return res.status(400).json({ error: 'Missing branchId' });
  }

  try {
    const receipts = await prisma.purchaseOrderReceipt.findMany({
      where: {
        branchId: Number(branchId),
        barcodeReceiptItem: {
          some: {},
        },
      },
      include: {
        purchaseOrder: {
          select: {
            code: true,
            supplier: {
              select: {
                name: true,
                creditLimit: true,
                creditBalance: true,
              },
            },
          },
        },
        barcodeReceiptItem: {
          select: {
            stockItemId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const result = receipts
      .map((r) => {
        const supplier = r.purchaseOrder?.supplier;
        const creditLimit = supplier?.creditLimit || 0;
        const creditUsed = supplier?.creditUsed || 0;
        const debitAmount = supplier?.debitAmount || 0;
        const creditAvailable = creditLimit - creditUsed + debitAmount;

        const total = r.barcodeReceiptItem.length;
        const scanned = r.barcodeReceiptItem.filter((i) => i.stockItemId !== null).length;

        return {
          id: r.id,
          code: r.code,
          purchaseOrderCode: r.purchaseOrder?.code || '-',
          supplier: supplier?.name || '-',
          createdAt: r.createdAt,
          total,
          scanned,
          creditAvailable,
          debitAmount,
        };
      })
      .filter((r) => r.total > r.scanned); // ✅ แสดงเฉพาะรายการที่ยังยิงไม่ครบ

    res.json(result);
  } catch (err) {
    console.error('[getReceiptsWithBarcodes]', err);
    res.status(500).json({ error: 'ไม่สามารถโหลดรายการใบรับสินค้าที่มีบาร์โค้ดได้' });
  }
};


const markBarcodesAsPrinted = async (req, res) => {
  const rawId = req.body?.purchaseOrderReceiptId;
  const branchId = req.user?.branchId;
  const purchaseOrderReceiptId = Number(rawId);
  
  if (!purchaseOrderReceiptId || !branchId || isNaN(purchaseOrderReceiptId)) {
    return res.status(400).json({ error: 'Missing or invalid purchaseOrderReceiptId or branchId' });
  }

  try {
    const updated = await prisma.barcodeReceiptItem.updateMany({
      where: {
        purchaseOrderReceiptId: purchaseOrderReceiptId,
        branchId: Number(branchId),
      },
      data: { printed: true },
    });

    return res.json({ success: true, updated: updated.count });
  } catch (err) {
    console.error('[markBarcodesAsPrinted] ❌', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  generateMissingBarcodes,
  getBarcodesByReceiptId,
  getReceiptsWithBarcodes,
  markBarcodesAsPrinted,
};
