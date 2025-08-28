
// 👉 Helper
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

// src/controllers/barcodeController.js

const { prisma, Prisma } = require('../lib/prisma');
const dayjs = require('dayjs');


// POST /api/barcodes/generate-missing/:receiptId
// สร้างบาร์โค้ดที่ขาดหายสำหรับใบรับสินค้าแบบอะตอมมิกและกันเลขชน (race-safe)
const generateMissingBarcodes = async (req, res) => {
  const receiptId = toInt(req.params?.receiptId);
  const userBranchId = toInt(req.user?.branchId);

  if (!Number.isInteger(receiptId) || !Number.isInteger(userBranchId)) {
    return res.status(400).json({ message: 'กรุณาระบุ receiptId และต้องมีสิทธิ์สาขา' });
  }

  try {
    const { createdCount, barcodes } = await _generateMissingBarcodesForReceipt(receiptId, userBranchId);
    return res.status(200).json({ success: true, createdCount, barcodes });
  } catch (error) {
    console.error('[generateMissingBarcodes] ❌', error);
    if (error?.status === 404 || error?.message === 'NOT_FOUND_RECEIPT') {
      return res.status(404).json({ message: 'ไม่พบใบรับในสาขาของคุณ' });
    }
    if (error?.status === 400 || error?.message === 'COUNTER_OVERFLOW') {
      return res.status(400).json({ message: 'เกินโควต้า 9999 ต่อเดือนต่อสาขา' });
    }
    return res.status(500).json({ message: 'ไม่สามารถสร้างบาร์โค้ดได้' });
  }
};

// 🔒 Internal: ใช้ซ้ำได้ทั้งจาก endpoint และจากจุด auto-generate
async function _generateMissingBarcodesForReceipt(receiptId, userBranchId) {
  return prisma.$transaction(async (tx) => {
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
      const notFoundErr = new Error('NOT_FOUND_RECEIPT');
      notFoundErr.status = 404;
      throw notFoundErr;
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

    const endNumber = updatedCounter.lastNumber;
    const startNumber = endNumber - totalMissing + 1;

    // 4.1) Guard: จำกัดเลขวิ่ง 4 หลัก/เดือน (0001–9999) และ rollback ถ้าเกินโควต้า
    if (endNumber > 9999) {
      await tx.barcodeCounter.update({
        where: { branchId_yearMonth: { branchId, yearMonth } },
        data: { lastNumber: { decrement: totalMissing } },
      });
      const overflowErr = new Error('COUNTER_OVERFLOW');
      overflowErr.status = 400;
      throw overflowErr;
    }

    // 4) กระจายเลขที่ได้ไปตามรายการที่ขาด
    const newBarcodes = [];
    let running = startNumber;
    for (const it of perItemMissing) {
      for (let i = 0; i < it.missing; i++) {
        const padded = String(running).padStart(4, '0');
        const code = `${String(branchId).padStart(3, '0')}${yearMonth}${padded}`;
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
}

// GET /api/barcodes/by-receipt/:receiptId ดึงข้อมูลแสดงในตาราง
const getBarcodesByReceiptId = async (req, res) => {
  const receiptId = toInt(req.params?.receiptId);
  const branchId = toInt(req.user?.branchId);

  if (!Number.isInteger(receiptId) || !Number.isInteger(branchId)) {
    return res.status(400).json({ message: 'กรุณาระบุ receiptId และต้องมีสิทธิ์สาขา' });
  }

  try {
    const includeTree = {
      stockItem: {
        select: {
          id: true,
          serialNumber: true,
          productId: true,
          product: {
            select: { id: true, name: true, model: true, spec: true },
          },
        },
      },
      receiptItem: {
        select: {
          purchaseOrderItem: {
            select: {
              productId: true,
              product: {
                select: { id: true, name: true, model: true, spec: true },
              },
            },
          },
        },
      },
    };

    let rows = await prisma.barcodeReceiptItem.findMany({
      where: { purchaseOrderReceiptId: receiptId, branchId },
      include: includeTree,
      orderBy: { id: 'asc' },
    });

    if (!rows.length) {
      const { createdCount } = await _generateMissingBarcodesForReceipt(receiptId, branchId);
      if (createdCount > 0) {
        rows = await prisma.barcodeReceiptItem.findMany({
          where: { purchaseOrderReceiptId: receiptId, branchId },
          include: includeTree,
          orderBy: { id: 'asc' },
        });
      }
    }

    const idSet = new Set();
    for (const b of rows) {
      const s = b.stockItem;
      const poi = b.receiptItem?.purchaseOrderItem;
      if (s?.product?.id) idSet.add(s.product.id);
      if (s?.productId) idSet.add(s.productId);
      if (poi?.product?.id) idSet.add(poi.product.id);
      if (poi?.productId) idSet.add(poi.productId);
    }
    let productMap = new Map();
    if (idSet.size > 0) {
      const products = await prisma.product.findMany({
        where: { id: { in: Array.from(idSet) } },
        select: { id: true, name: true, model: true, spec: true },
      });
      productMap = new Map(products.map((p) => [p.id, p]));
    }

    const receiptPO = await prisma.purchaseOrderReceipt.findFirst({
      where: { id: receiptId, branchId },
      select: { purchaseOrderId: true },
    });

    let poItemMap = new Map();
    let recToPoMap = new Map();

    if (receiptPO?.purchaseOrderId) {
      const poItems = await prisma.purchaseOrderItem.findMany({
        where: { purchaseOrderId: receiptPO.purchaseOrderId },
        select: {
          id: true,
          productId: true,
          product: { select: { id: true, name: true, model: true, spec: true } },
        },
      });
      poItemMap = new Map(poItems.map((it) => [it.id, it]));

      const recIds = Array.from(new Set(rows.map((r) => r.receiptItemId).filter(Boolean)));
      if (recIds.length) {
        const recItems = await prisma.purchaseOrderReceiptItem.findMany({
          where: { id: { in: recIds } },
          select: { id: true, purchaseOrderItemId: true },
        });
        recToPoMap = new Map(recItems.map((x) => [x.id, x.purchaseOrderItemId]));
      }
    }

    const briIds = Array.from(new Set(rows.map((r) => r.id).filter(Boolean)));
    const recItemIds = Array.from(new Set(rows.map((r) => r.receiptItemId).filter(Boolean)));
    let siByBRI = new Map();
    let siByReceiptItem = new Map();
    if (briIds.length || recItemIds.length) {
      const briLinks = await prisma.barcodeReceiptItem.findMany({
        where: { id: { in: briIds }, branchId, stockItemId: { not: null } },
        select: { id: true, stockItem: { select: { id: true, serialNumber: true } } },
      });
      siByBRI = new Map(
        briLinks
          .map((x) => [x.id, x.stockItem])
          .filter(([k, v]) => k != null && v != null)
      );
      // Note: siByReceiptItem is left empty as a secondary fallback; primary mapping is via BRI -> StockItem.
      // siByBRI built above via briLinks
      // siByReceiptItem left empty in this patch; optional secondary fallback
    }

    const barcodes = rows.map((b) => {
      const pStock = b.stockItem?.product ?? null;
      const pPO = b.receiptItem?.purchaseOrderItem?.product ?? null;

      const pFromId =
        (b.stockItem?.productId && productMap.get(b.stockItem.productId)) ||
        (b.receiptItem?.purchaseOrderItem?.productId && productMap.get(b.receiptItem.purchaseOrderItem.productId)) ||
        null;

      const poItemId = recToPoMap.get(b.receiptItemId);
      const poItem = poItemId ? poItemMap.get(poItemId) : null;
      const pFromPOChain = poItem?.product || (poItem?.productId ? productMap.get(poItem.productId) : null);
      const p = pStock ?? pPO ?? pFromId ?? pFromPOChain;

      const baseName = p?.name ?? null;

      const productName = baseName && p?.model ? `${baseName} (${p.model})` : baseName;
      const productSpec = p?.spec ?? null;

      const siFallback = b.stockItemId
        ? null
        : siByBRI.get(b.id) || (b.receiptItemId ? siByReceiptItem.get(b.receiptItemId) : null);
      const stockItemId = b.stockItemId ?? siFallback?.id ?? null;
      const serialNumber = b.stockItem?.serialNumber ?? siFallback?.serialNumber ?? null;

      return {
        id: b.id,
        barcode: b.barcode,
        stockItemId,
        serialNumber,
        productId: p?.id ?? b.stockItem?.productId ?? b.receiptItem?.purchaseOrderItem?.productId ?? null,
        productName,
        productSpec,
      };
    });

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    return res.status(200).json({ success: true, count: barcodes.length, barcodes });
  } catch (error) {
    console.error('[getBarcodesByReceiptId] ❌', error);
    return res.status(500).json({ message: 'ไม่สามารถดึงบาร์โค้ดได้' });
  }
};




// GET /api/barcodes/receipts-with-barcodes
const getReceiptsWithBarcodes = async (req, res) => {
  const branchId = toInt(req.user?.branchId);

  if (!Number.isInteger(branchId)) {
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

// GET /api/barcodes/reprint-search
const searchReprintReceipts = async (req, res) => {
  const branchId = toInt(req.user?.branchId);

  if (!Number.isInteger(branchId)) {
    return res.status(400).json({ message: 'ต้องมี branchId' });
  }

  const mode = String(req.query?.mode || 'RC').toUpperCase();
  const q = String(req.query?.query || '').trim();
  const printedFlag = String(req.query?.printed ?? 'true').toLowerCase() === 'true';

  if (!q) {
    return res.json([]); // ไม่มีคำค้น → คืน array ว่าง
  }

  try {
    const where = {
      branchId,
      barcodeReceiptItem: printedFlag ? { some: { printed: true } } : { some: {} },
    };

    if (mode === 'RC') {
      where.code = { contains: q, mode: 'insensitive' };
    } else if (mode === 'PO') {
      where.purchaseOrder = { is: { code: { contains: q, mode: 'insensitive' } } };
    }

    const receipts = await prisma.purchaseOrderReceipt.findMany({
      where,
      include: {
        purchaseOrder: { select: { code: true, supplier: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const rows = receipts.map((r) => ({
      id: r.id,
      code: r.code,
      purchaseOrderCode: r.purchaseOrder?.code || '-',
      supplier: r.purchaseOrder?.supplier?.name || '-',
      createdAt: r.createdAt,
    }));

    return res.json(rows);
  } catch (err) {
    console.error('[searchReprintReceipts] ❌', err);
    return res.status(500).json({ message: 'ค้นหาใบรับสำหรับพิมพ์ซ้ำล้มเหลว' });
  }
};


// PATCH /api/barcodes/reprint/:receiptId
const reprintBarcodes = async (req, res) => {
  const receiptId = toInt(req.params?.receiptId);
  const branchId = toInt(req.user?.branchId);

  if (!Number.isInteger(receiptId) || !Number.isInteger(branchId)) {
    return res.status(400).json({ message: 'พารามิเตอร์ไม่ถูกต้อง' });
  }

  try {
    const receipt = await prisma.purchaseOrderReceipt.findFirst({
      where: { id: receiptId, branchId },
      select: { id: true },
    });
    if (!receipt) {
      return res.status(404).json({ message: 'ไม่พบใบรับในสาขาของคุณ' });
    }

    const includeTree = {
      stockItem: {
        select: {
          id: true,
          serialNumber: true,
          productId: true,
          product: {
            select: { id: true, name: true, model: true, spec: true },
          },
        },
      },
      receiptItem: {
        select: {
          purchaseOrderItem: {
            select: {
              productId: true,
              product: {
                select: { id: true, name: true, model: true, spec: true },
              },
            },
          },
        },
      },
    };

    const items = await prisma.barcodeReceiptItem.findMany({
      where: { purchaseOrderReceiptId: receiptId, branchId },
      include: includeTree,
      orderBy: { id: 'asc' },
    });

    // ✅ ทำ product map แบบเดียวกับด้านบน
    const idSet = new Set();
    for (const b of items) {
      const s = b.stockItem;
      const poi = b.receiptItem?.purchaseOrderItem;
      if (s?.product?.id) idSet.add(s.product.id);
      if (s?.productId) idSet.add(s.productId);
      if (poi?.product?.id) idSet.add(poi.product.id);
      if (poi?.productId) idSet.add(poi.productId);
    }
    let productMap = new Map();
    if (idSet.size > 0) {
      const products = await prisma.product.findMany({
        where: { id: { in: Array.from(idSet) } },
        select: { id: true, name: true, model: true, spec: true },
      });
      productMap = new Map(products.map((p) => [p.id, p]));
    }

    // 🔁 Fallback เพิ่มเติม (ตามเส้นทางที่ระบุ) สำหรับพิมพ์ซ้ำ:
    // BRI -> PurchaseOrderReceipt -> PurchaseOrder -> PurchaseOrderItem -> Product
    const receiptPO = await prisma.purchaseOrderReceipt.findFirst({
      where: { id: receiptId, branchId },
      select: { purchaseOrderId: true },
    });

    let poItemMap = new Map();
    let recToPoMap = new Map();

    if (receiptPO?.purchaseOrderId) {
      const poItems = await prisma.purchaseOrderItem.findMany({
        where: { purchaseOrderId: receiptPO.purchaseOrderId },
        select: {
          id: true,
          productId: true,
          product: { select: { id: true, name: true, model: true, spec: true } },
        },
      });
      poItemMap = new Map(poItems.map((it) => [it.id, it]));

      const recIds = Array.from(new Set(items.map((r) => r.receiptItemId).filter(Boolean)));
      if (recIds.length) {
        const recItems = await prisma.purchaseOrderReceiptItem.findMany({
          where: { id: { in: recIds } },
          select: { id: true, purchaseOrderItemId: true },
        });
        recToPoMap = new Map(recItems.map((x) => [x.id, x.purchaseOrderItemId]));
      }
    }

    // 🔁 Build fallback maps for StockItem for reprint
    const briIds2 = Array.from(new Set(items.map((r) => r.id).filter(Boolean)));
    const recItemIds2 = Array.from(new Set(items.map((r) => r.receiptItemId).filter(Boolean)));
    let siByBRI = new Map();
    let siByReceiptItem = new Map();
    if (briIds2.length || recItemIds2.length) {
      const stockItems2 = await prisma.stockItem.findMany({
        where: {
          branchId,
          OR: [
            briIds2.length ? { barcodeReceiptItemId: { in: briIds2 } } : undefined,
            recItemIds2.length ? { purchaseOrderReceiptItemId: { in: recItemIds2 } } : undefined,
          ].filter(Boolean),
        },
        select: { id: true, serialNumber: true, barcodeReceiptItemId: true, purchaseOrderReceiptItemId: true },
      });
      siByBRI = new Map(stockItems2.map((s) => [s.barcodeReceiptItemId, s]));
      siByReceiptItem = new Map(stockItems2.map((s) => [s.purchaseOrderReceiptItemId, s]));
    }

    const barcodes = items.map((b) => {
      const pStock = b.stockItem?.product ?? null;
      const pPO = b.receiptItem?.purchaseOrderItem?.product ?? null;
      const pFromId =
        (b.stockItem?.productId && productMap.get(b.stockItem.productId)) ||
        (b.receiptItem?.purchaseOrderItem?.productId && productMap.get(b.receiptItem.purchaseOrderItem.productId)) ||
        null;

      const poItemId = recToPoMap.get(b.receiptItemId);
      const poItem = poItemId ? poItemMap.get(poItemId) : null;
      const pFromPOChain = poItem?.product || (poItem?.productId ? productMap.get(poItem.productId) : null);
      const p = pStock ?? pPO ?? pFromId ?? pFromPOChain;

      const baseName = p?.name ?? null;
      const productName = baseName && p?.model ? `${baseName} (${p.model})` : baseName;
      const productSpec = p?.spec ?? null;

      // ✅ Fallback หา stockItem (id/SN) สำหรับพิมพ์ซ้ำ
      const siFallback = b.stockItemId
        ? null
        : siByBRI.get(b.id) || (b.receiptItemId ? siByReceiptItem.get(b.receiptItemId) : null);
      const stockItemId = b.stockItemId ?? siFallback?.id ?? null;
      const serialNumber = b.stockItem?.serialNumber ?? siFallback?.serialNumber ?? null;

      if (!productName) {
        console.warn('[reprint:noProductName]', {
          id: b.id,
          barcode: b.barcode,
          stockItemId: b.stockItemId,
          si_productId: b.stockItem?.productId || null,
          poi_productId: b.receiptItem?.purchaseOrderItem?.productId || null,
          hasStockProduct: !!b.stockItem?.product,
          hasPOProduct: !!b.receiptItem?.purchaseOrderItem?.product,
        });
      }

      return {
        id: b.id,
        barcode: b.barcode,
        printed: !!b.printed,
        stockItemId,
        serialNumber,
        productId: p?.id ?? b.stockItem?.productId ?? b.receiptItem?.purchaseOrderItem?.productId ?? null,
        productName,
        productSpec,
      };
    });

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    return res.json({ success: true, count: barcodes.length, barcodes });
  } catch (err) {
    console.error('[reprintBarcodes] ❌', err);
    return res.status(500).json({ message: 'ไม่สามารถพิมพ์ซ้ำได้' });
  }
};


module.exports = {
  generateMissingBarcodes,
  getBarcodesByReceiptId,
  getReceiptsWithBarcodes,  
  reprintBarcodes,
  searchReprintReceipts,
};




