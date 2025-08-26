// src/controllers/barcodeController.js

const { prisma, Prisma } = require('../lib/prisma');
const dayjs = require('dayjs');

// 👉 Helper
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

// POST /api/barcodes/generate-missing/:receiptId
// สร้างบาร์โค้ดที่ขาดหายสำหรับใบรับสินค้าแบบอะตอมมิกและกันเลขชน (race-safe)
const generateMissingBarcodes = async (req, res) => {
  const receiptId = toInt(req.params?.receiptId);
  const userBranchId = toInt(req.user?.branchId);

  if (!receiptId || !userBranchId) {
    return res.status(400).json({ message: 'กรุณาระบุ receiptId และต้องมีสิทธิ์สาขา' });
  }

  try {
    const { createdCount, barcodes } = await prisma.$transaction(async (tx) => {
      // 1) โหลดใบรับภายใต้สาขาของผู้ใช้ (ป้องกันข้ามสาขา)
      const receipt = await tx.purchaseOrderReceipt.findFirst({
        where: { id: receiptId, branchId: userBranchId },
        include: {
          items: {
            include: {
              purchaseOrderItem: true,
              barcodeReceiptItem: true,
            },
          },
          purchaseOrder: { select: { id: true, code: true } },
        },
      });

      if (!receipt) {
        throw new Prisma.PrismaClientKnownRequestError('ไม่พบใบรับในสาขาของคุณ', { code: 'P2025', clientVersion: 'NA' });
      }

      // 2) คำนวณจำนวนที่ต้องสร้าง (sum ของ missing ในแต่ละรายการ)
      const yearMonth = dayjs().format('YYMM');
      const branchId = receipt.branchId;

      const perItemMissing = receipt.items.map((it) => {
        const qty = Number(it.quantity || 0);
        const existing = Array.isArray(it.barcodeReceiptItem) ? it.barcodeReceiptItem.length : 0;
        const missing = Math.max(0, qty - existing);
        return { id: it.id, missing };
      });

      const totalMissing = perItemMissing.reduce((s, x) => s + x.missing, 0);
      if (totalMissing === 0) {
        return { createdCount: 0, barcodes: [] };
      }

      // 3) เตรียม counter (มีหรือไม่ก็ upsert) แล้วจองเลขแบบ increment ทีเดียวกัน race
      await tx.barcodeCounter.upsert({
        where: { branchId_yearMonth: { branchId, yearMonth } },
        update: {},
        create: { branchId, yearMonth, lastNumber: 0 },
      });

      const updatedCounter = await tx.barcodeCounter.update({
        where: { branchId_yearMonth: { branchId, yearMonth } },
        data: { lastNumber: { increment: totalMissing } },
      });

      const startNumber = updatedCounter.lastNumber - totalMissing + 1;

      // 4) กระจายเลขที่ได้ไปตามรายการที่ขาด
      const newBarcodes = [];
      let running = startNumber;
      for (const it of perItemMissing) {
        for (let i = 0; i < it.missing; i++) {
          const padded = String(running).padStart(4, '0');
          const code = `${String(branchId).padStart(2, '0')}${yearMonth}${padded}`;
          newBarcodes.push({
            barcode: code,
            branchId,
            yearMonth,
            runningNumber: running,
            status: 'READY',
            printed: false,
            purchaseOrderReceiptId: receipt.id,
            receiptItemId: it.id,
          });
          running += 1;
        }
      }

      // 5) สร้างบาร์โค้ดทั้งหมดในชุดเดียว
      if (newBarcodes.length > 0) {
        await tx.barcodeReceiptItem.createMany({ data: newBarcodes, skipDuplicates: true });
      }

      return { createdCount: newBarcodes.length, barcodes: newBarcodes };
    }, { timeout: 30000 });

    return res.status(200).json({ success: true, createdCount, barcodes });
  } catch (error) {
    console.error('[generateMissingBarcodes] ❌', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ message: 'ไม่พบใบรับในสาขาของคุณ' });
    }
    return res.status(500).json({ message: 'ไม่สามารถสร้างบาร์โค้ดได้' });
  }
};

// GET /api/barcodes/by-receipt/:receiptId
const getBarcodesByReceiptId = async (req, res) => {
  const receiptId = toInt(req.params?.receiptId);
  const branchId = toInt(req.user?.branchId);

  if (!receiptId || !branchId) {
    return res.status(400).json({ message: 'กรุณาระบุ receiptId และต้องมีสิทธิ์สาขา' });
  }

  try {
    const barcodes = await prisma.barcodeReceiptItem.findMany({
      where: { purchaseOrderReceiptId: receiptId, branchId },
      include: {
        stockItem: true,
        receiptItem: {
          include: {
            purchaseOrderItem: {
              include: {
                product: { select: { name: true, spec: true } },
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
        name: b.receiptItem?.purchaseOrderItem?.product?.name || '',
        spec: b.receiptItem?.purchaseOrderItem?.product?.spec || '',
      },
    }));

    return res.status(200).json({ success: true, count: simplified.length, barcodes: simplified });
  } catch (error) {
    console.error('[getBarcodesByReceiptId] ❌', error);
    return res.status(500).json({ message: 'ไม่สามารถดึงบาร์โค้ดได้' });
  }
};

// GET /api/barcodes/receipts-with-barcodes
const getReceiptsWithBarcodes = async (req, res) => {
  const branchId = toInt(req.user?.branchId);

  if (!branchId) {
    return res.status(400).json({ message: 'ต้องมี branchId' });
  }

  try {
    const receipts = await prisma.purchaseOrderReceipt.findMany({
      where: { branchId, barcodeReceiptItem: { some: {} } },
      include: {
        purchaseOrder: {
          select: {
            code: true,
            supplier: { select: { name: true, creditLimit: true, creditBalance: true } },
          },
        },
        barcodeReceiptItem: { select: { stockItemId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = receipts
      .map((r) => {
        const supplier = r.purchaseOrder?.supplier;
        const creditLimit = Number(supplier?.creditLimit || 0);
        const creditBalance = Number(supplier?.creditBalance || 0);
        const creditRemaining = creditLimit - creditBalance; // ✅ กำหนดความหมายให้ชัดเจน

        const total = r.barcodeReceiptItem.length;
        const scanned = r.barcodeReceiptItem.filter((i) => i.stockItemId !== null).length;

        return {
          id: r.id,
          code: r.code,
          tax: r.supplierTaxInvoiceNumber,
          purchaseOrderCode: r.purchaseOrder?.code || '-',
          supplier: supplier?.name || '-',
          createdAt: r.createdAt,
          total,
          scanned,
          creditRemaining,
          creditBalance,
        };
      })
      .filter((r) => r.total > r.scanned); // ✅ แสดงเฉพาะที่ยังยิงไม่ครบ

    res.json(result);
  } catch (err) {
    console.error('[getReceiptsWithBarcodes]', err);
    res.status(500).json({ message: 'ไม่สามารถโหลดรายการใบรับสินค้าที่มีบาร์โค้ดได้' });
  }
};

// PATCH /api/barcodes/mark-printed
const markBarcodesAsPrinted = async (req, res) => {
  const purchaseOrderReceiptId = toInt(req.body?.purchaseOrderReceiptId);
  const branchId = toInt(req.user?.branchId);

  if (!purchaseOrderReceiptId || !branchId) {
    return res.status(400).json({ message: 'กรุณาระบุ purchaseOrderReceiptId และต้องมีสิทธิ์สาขา' });
  }

  try {
    const updated = await prisma.barcodeReceiptItem.updateMany({
      where: { purchaseOrderReceiptId, branchId },
      data: { printed: true },
    });

    return res.json({ success: true, updated: updated.count });
  } catch (err) {
    console.error('[markBarcodesAsPrinted] ❌', err);
    return res.status(500).json({ message: 'ไม่สามารถอัปเดตสถานะ printed ได้' });
  }
};

module.exports = {
  generateMissingBarcodes,
  getBarcodesByReceiptId,
  getReceiptsWithBarcodes,
  markBarcodesAsPrinted,
};
