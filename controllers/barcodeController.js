// src/controllers/barcodeController.js

// 👉 Helper
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

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
    // ✅ รองรับ dryRun + lotLabelPerLot
    const rawDry = (req.body?.dryRun ?? req.query?.dryRun ?? 'false');
    const dryRun = String(rawDry).toLowerCase() === '1' || String(rawDry).toLowerCase() === 'true';
    const lotLabelPerLot = Math.max(1, Number(req.body?.lotLabelPerLot ?? req.query?.lotLabelPerLot ?? 1));

    const result = await _generateMissingBarcodesForReceipt(receiptId, userBranchId, { dryRun, lotLabelPerLot });

    if (dryRun) {
      return res.status(200).json({
        success: true,
        dryRun: true,
        plan: result.plan,
        totalToCreate: result.totalToCreate,
      });
    }

    return res.status(200).json({ success: true, createdCount: result.createdCount, barcodes: result.barcodes });
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
async function _generateMissingBarcodesForReceipt(receiptId, userBranchId, opts = {}) {
  const { dryRun = false, lotLabelPerLot = 1 } = opts;

  return prisma.$transaction(
    async (tx) => {
      // 1) โหลดใบรับภายใต้สาขาของผู้ใช้ + โหมดสินค้า
      const receipt = await tx.purchaseOrderReceipt.findFirst({
        where: { id: receiptId, branchId: userBranchId },
        include: {
          items: {
            include: {
              purchaseOrderItem: {
                select: {
                  id: true,
                  productId: true,
                  product: { select: { id: true, mode: true } },
                },
              },
              product: { select: { id: true, mode: true } }, // สำรองสำหรับ QUICK/PO-less
              barcodeReceiptItem: { select: { id: true, kind: true, stockItemId: true, simpleLotId: true } },
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

      const yearMonth = dayjs().format('YYMM');
      const branchId = receipt.branchId;

      // 2) สร้างแผนแบบแยกโหมด
      const plansSN = []; // [{ receiptItemId, count }]
      const plansLOT = []; // [{ receiptItemId, count: 1, lotLabelPerLot }]

      for (const it of receipt.items) {
        const qty = Number(it.quantity || 0);
        const existingSN = (it.barcodeReceiptItem || []).filter((x) => x.kind === 'SN' || x.stockItemId).length;
        const existingLOT = (it.barcodeReceiptItem || []).filter((x) => x.kind === 'LOT' || x.simpleLotId).length;

        const mode = it.purchaseOrderItem?.product?.mode || it.product?.mode || null;

        if (mode === 'STRUCTURED') {
          const missing = Math.max(0, qty - existingSN);
          if (missing > 0) plansSN.push({ receiptItemId: it.id, count: missing });
        } else if (mode === 'SIMPLE') {
          const missing = existingLOT > 0 ? 0 : 1; // 1 lot = 1 barcode แถวเดียว
          if (missing > 0) plansLOT.push({ receiptItemId: it.id, count: 1, lotLabelPerLot });
        } else {
          // ไม่ทราบโหมด → ไม่สร้างอะไร ปลอดภัยสุด
        }
      }

      const totalToCreate =
        plansSN.reduce((s, p) => s + p.count, 0) +
        plansLOT.reduce((s, p) => s + p.count, 0);

      if (dryRun) {
        return { totalToCreate, plan: { SN: plansSN, LOT: plansLOT } };
      }

      if (totalToCreate === 0) {
        return { createdCount: 0, barcodes: [] };
      }

      // 3) เตรียม counter และจองเลขรวดเดียว (race-safe)
      await tx.barcodeCounter.upsert({
        where: { branchId_yearMonth: { branchId, yearMonth } },
        update: {},
        create: { branchId, yearMonth, lastNumber: 0 },
      });

      const updatedCounter = await tx.barcodeCounter.update({
        where: { branchId_yearMonth: { branchId, yearMonth } },
        data: { lastNumber: { increment: totalToCreate } },
      });

      const endNumber = updatedCounter.lastNumber;
      const startNumber = endNumber - totalToCreate + 1;

      // Guard โควต้า/เดือน (0001–9999)
      if (endNumber > 9999) {
        await tx.barcodeCounter.update({
          where: { branchId_yearMonth: { branchId, yearMonth } },
          data: { lastNumber: { decrement: totalToCreate } },
        });
        const overflowErr = new Error('COUNTER_OVERFLOW');
        overflowErr.status = 400;
        throw overflowErr;
      }

      // 4) สร้างชุดบาร์โค้ดตามแผน (เลขเดียวกัน ใช้ต่อเนื่อง SN/LOT)
      const newBarcodes = [];
      let running = startNumber;

      const pushNew = (receiptItemId, kind) => {
        const padded = String(running).padStart(4, '0');
        const code = `${String(branchId).padStart(3, '0')}${yearMonth}${padded}`;
        newBarcodes.push({
          barcode: code,
          branchId,
          yearMonth,
          runningNumber: running,
          status: 'READY',
          printed: false,
          kind, // 'SN' | 'LOT'
          purchaseOrderReceiptId: receipt.id,
          receiptItemId,
        });
        running += 1;
      };

      for (const plan of plansSN) {
        for (let i = 0; i < plan.count; i++) pushNew(plan.receiptItemId, 'SN');
      }
      for (const plan of plansLOT) {
        for (let i = 0; i < plan.count; i++) pushNew(plan.receiptItemId, 'LOT');
      }

      if (newBarcodes.length > 0) {
        await tx.barcodeReceiptItem.createMany({ data: newBarcodes, skipDuplicates: true });
      }

      return { createdCount: newBarcodes.length, barcodes: newBarcodes };
    },
    { timeout: 30000 }
  );
}

// GET /api/barcodes/by-receipt/:receiptId ดึงข้อมูลแสดงในตาราง
const getBarcodesByReceiptId = async (req, res) => {
  const receiptId = toInt(req.params?.receiptId);
  const branchId = toInt(req.user?.branchId);

  if (!Number.isInteger(receiptId) || !Number.isInteger(branchId)) {
    return res.status(400).json({ message: 'กรุณาระบุ receiptId และต้องมีสิทธิ์สาขา' });
  }

  try {
    // 🔎 Optional filters for scan page
    const kindParam = String(req.query?.kind || '').toUpperCase();
    const kindFilter = kindParam === 'SN' || kindParam === 'LOT' ? kindParam : undefined;
    const onlyUnscanned = ['1', 'true', 'yes'].includes(String(req.query?.onlyUnscanned || '0').toLowerCase());
    const onlyUnactivated = ['1', 'true', 'yes'].includes(String(req.query?.onlyUnactivated || '0').toLowerCase());

    // Ensure barcodes exist first (auto-generate only if the receipt has zero BRI at all)
    const totalExisting = await prisma.barcodeReceiptItem.count({
      where: { purchaseOrderReceiptId: receiptId, branchId },
    });
    if (totalExisting === 0) {
      await _generateMissingBarcodesForReceipt(receiptId, branchId, { dryRun: false, lotLabelPerLot: 1 });
    }

    const includeTree = {
      stockItem: {
        select: {
          id: true,
          serialNumber: true,
          productId: true,
          product: { select: { id: true, name: true } },
        },
      },
      receiptItem: {
        select: {
          quantity: true,
          purchaseOrderItem: {
            select: {
              productId: true,
              product: { select: { id: true, name: true } },
            },
          },
        },
      },
    };

    const whereClause = {
      purchaseOrderReceiptId: receiptId,
      branchId,
      ...(kindFilter ? { kind: kindFilter } : {}),
      ...(onlyUnscanned ? { stockItemId: null } : {}),
      ...(onlyUnactivated && kindFilter === 'LOT' ? { status: { not: 'SN_RECEIVED' } } : {}),
    };

    const rows = await prisma.barcodeReceiptItem.findMany({
      where: whereClause,
      include: includeTree,
      orderBy: { id: 'asc' },
    });

    // ✅ ทำ product map
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
        select: { id: true, name: true },
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
    let recQtyMap = new Map();

    if (receiptPO?.purchaseOrderId) {
      const poItems = await prisma.purchaseOrderItem.findMany({
        where: { purchaseOrderId: receiptPO.purchaseOrderId },
        select: { id: true, productId: true, product: { select: { id: true, name: true } } },
      });
      poItemMap = new Map(poItems.map((it) => [it.id, it]));

      const recIds = Array.from(new Set(rows.map((r) => r.receiptItemId).filter(Boolean)));
      if (recIds.length) {
        const recItems = await prisma.purchaseOrderReceiptItem.findMany({
          where: { id: { in: recIds } },
          select: { id: true, purchaseOrderItemId: true, quantity: true },
        });
        recToPoMap = new Map(recItems.map((x) => [x.id, x.purchaseOrderItemId]));
        recQtyMap = new Map(recItems.map((x) => [x.id, Number(x.quantity || 0)]));
      }
    } else {
      const recIds = Array.from(new Set(rows.map((r) => r.receiptItemId).filter(Boolean)));
      if (recIds.length) {
        const recItems = await prisma.purchaseOrderReceiptItem.findMany({
          where: { id: { in: recIds } },
          select: { id: true, quantity: true },
        });
        recQtyMap = new Map(recItems.map((x) => [x.id, Number(x.quantity || 0)]));
      }
    }

    // 🔁 Build fallback maps for StockItem
    const briIds2 = Array.from(new Set(rows.map((r) => r.id).filter(Boolean)));
    const recItemIds2 = Array.from(new Set(rows.map((r) => r.receiptItemId).filter(Boolean)));

    let siByBRI = new Map();
    let siByReceiptItem = new Map();

    // (1) BRI -> StockItem
    if (briIds2.length) {
      const briLinks2 = await prisma.barcodeReceiptItem.findMany({
        where: { id: { in: briIds2 }, branchId, stockItemId: { not: null } },
        select: { id: true, stockItem: { select: { id: true, serialNumber: true } } },
      });
      siByBRI = new Map(
        briLinks2
          .map((x) => [x.id, x.stockItem])
          .filter(([k, v]) => k != null && v != null)
      );
    }

    // (2) ReceiptItem -> StockItem
    if (recItemIds2.length) {
      const stockItemsByRecItem = await prisma.stockItem.findMany({
        where: { branchId, purchaseOrderReceiptItemId: { in: recItemIds2 } },
        select: { id: true, serialNumber: true, purchaseOrderReceiptItemId: true },
      });
      siByReceiptItem = new Map(
        stockItemsByRecItem
          .map((s) => [s.purchaseOrderReceiptItemId, s])
          .filter(([k, v]) => k != null && v != null)
      );
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

      const productName = p?.name ?? null;
      const productSpec = null; // schema: no Product.spec

      // ✅ Fallback หา stockItem (id/SN)
      const siFallback = b.stockItemId
        ? null
        : siByBRI.get(b.id) || (b.receiptItemId ? siByReceiptItem.get(b.receiptItemId) : null);
      const stockItemId = b.stockItemId ?? siFallback?.id ?? null;
      const serialNumber = b.stockItem?.serialNumber ?? siFallback?.serialNumber ?? null;

      const kind = b.kind ?? (b.stockItemId ? 'SN' : b.simpleLotId ? 'LOT' : null);

      // 👉 Suggest number of duplicate labels for LOT (print convenience)
      const qtyFromInclude = Number(b.receiptItem?.quantity || 0);
      const qtyFromMap = b.receiptItemId ? recQtyMap.get(b.receiptItemId) || 0 : 0;
      const qtyLabelsSuggested = kind === 'LOT' ? Math.max(1, qtyFromInclude || qtyFromMap || 1) : 1;

      return {
        id: b.id,
        barcode: b.barcode,
        printed: !!b.printed,
        kind,
        status: b.status || null,
        stockItemId,
        simpleLotId: b.simpleLotId ?? null,
        receiptItemId: b.receiptItemId ?? null,
        serialNumber,
        productId: p?.id ?? b.stockItem?.productId ?? b.receiptItem?.purchaseOrderItem?.productId ?? null,
        productName,
        productSpec,
        qtyLabelsSuggested,
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

// ---- Mark single receipt as completed ----
const markReceiptAsCompleted = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const branchId = Number(req.user?.branchId);

    if (!id || !branchId) {
      return res.status(400).json({ error: 'ต้องระบุ id และสิทธิ์สาขา' });
    }

    const exists = await prisma.purchaseOrderReceipt.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!exists) return res.status(404).json({ error: 'ไม่พบใบรับสินค้าสำหรับสาขานี้' });

    const result = await prisma.purchaseOrderReceipt.updateMany({
      where: { id, branchId },
      data: { statusReceipt: 'COMPLETED' },
    });

    if (result.count === 0) {
      return res.status(409).json({ error: 'อัปเดตไม่สำเร็จ (อาจถูกเปลี่ยนแปลงแล้ว)' });
    }

    const receipt = await prisma.purchaseOrderReceipt.findFirst({
      where: { id, branchId },
      select: { id: true, code: true, statusReceipt: true },
    });

    return res.json({ success: true, receipt });
  } catch (error) {
    console.error('❌ [markReceiptAsCompleted] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถอัปเดตสถานะใบรับสินค้าได้' });
  }
};

// ---- Mark barcodes as printed (PATCH /api/barcodes/mark-printed) ----
// BRANCH_SCOPE_ENFORCED: ใช้ branchId จาก req.user เท่านั้น
// รองรับ body หลายรูปแบบ: { purchaseOrderReceiptId } | { receiptId } | { id }
const markBarcodesAsPrinted = async (req, res) => {
  try {
    // ---- debug logs ----
    console.log('[markBarcodesAsPrinted] headers.ct', req.headers['content-type']);
    console.log('[markBarcodesAsPrinted] req.user:', req.user);
    console.log('[markBarcodesAsPrinted] typeof body =', typeof req.body, 'body =', req.body);
    console.log('[markBarcodesAsPrinted] req.query =', req.query);

    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ message: 'unauthorized: missing branchId' });

    // ---- robust id extractor ----
    const pickId = (src) => {
      if (src == null) return undefined;
      // primitive number or numeric string
      if (typeof src === 'number' || (typeof src === 'string' && src.trim() !== '')) {
        const n = Number(src);
        if (Number.isFinite(n) && n > 0) return n;
      }
      if (typeof src !== 'object') return undefined;
      const candidates = [
        src.purchaseOrderReceiptId,
        src.receiptId,
        src.id,
        src?.purchaseOrderReceipt?.id,
        src?.payload?.id,
        src?.data?.id,
        src?.purchaseOrderReceiptId?.id,
        src?.purchaseOrderReceiptId?.purchaseOrderReceiptId,
      ];
      for (const c of candidates) {
        const n = Number(c);
        if (Number.isFinite(n) && n > 0) return n;
      }
      return undefined;
    };

    const purchaseOrderReceiptId = pickId(req.body) ?? pickId(req.query) ?? Number(req.get('x-receipt-id'));

    if (!Number.isFinite(purchaseOrderReceiptId) || purchaseOrderReceiptId <= 0) {
      console.warn(
        '[markBarcodesAsPrinted] missing receipt id. keys(body)=',
        typeof req.body === 'object' && req.body ? Object.keys(req.body) : '(primitive)',
        'query=',
        req.query
      );
      return res.status(400).json({ message: 'ต้องระบุ purchaseOrderReceiptId (หรือ receiptId/id)' });
    }

    // one-shot & idempotent
    const [itemsResult, receiptResult] = await prisma.$transaction([
      prisma.barcodeReceiptItem.updateMany({
        where: { branchId, purchaseOrderReceiptId, printed: false },
        data: { printed: true },
      }),
      prisma.purchaseOrderReceipt.updateMany({
        where: { id: purchaseOrderReceiptId, branchId },
        data: { printed: true },
      }),
    ]);

    console.log(
      '[markBarcodesAsPrinted] updated items:',
      itemsResult.count,
      'receipt updated:',
      receiptResult.count
    );

    return res.json({ success: true, updated: itemsResult.count, receiptUpdated: receiptResult.count });
  } catch (error) {
    console.error('❌ [markBarcodesAsPrinted] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถอัปเดตสถานะ printed ได้', error: error?.message });
  }
};

// GET /api/barcodes/receipts-with-barcodes
// รายการใบรับที่ "รอพิมพ์บาร์โค้ด" ให้สะท้อน SIMPLE/STRUCTURED อย่างถูกต้อง
// Criteria: มีบาร์โค้ดแล้วแต่ยังไม่ printed อย่างน้อย 1 รายการ
const getReceiptsWithBarcodes = async (req, res) => {
  const branchId = toInt(req.user?.branchId);

  if (!Number.isInteger(branchId)) {
    return res.status(400).json({ message: 'ต้องมี branchId' });
  }

  try {
    const receipts = await prisma.purchaseOrderReceipt.findMany({
      where: { branchId, barcodeReceiptItem: { some: { printed: false } } },
      include: {
        purchaseOrder: {
          select: {
            code: true,
            supplier: { select: { name: true, creditLimit: true, creditBalance: true } },
          },
        },
        // ดึงเฉพาะฟิลด์ที่ต้องใช้สรุปคิว
        barcodeReceiptItem: { select: { id: true, printed: true, kind: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const rows = receipts
      .map((r) => {
        const supplier = r.purchaseOrder?.supplier;
        const creditLimit = Number(supplier?.creditLimit || 0);
        const creditBalance = Number(supplier?.creditBalance || 0);
        const creditRemaining = creditLimit - creditBalance;

        const total = r.barcodeReceiptItem.length; // รวมทุก kind
        const printed = r.barcodeReceiptItem.filter((i) => i.printed).length;
        const pending = total - printed;

        // แยกตาม kind เพื่อช่วย UI/Debug
        const totalSN = r.barcodeReceiptItem.filter((i) => i.kind === 'SN').length;
        const totalLOT = r.barcodeReceiptItem.filter((i) => i.kind === 'LOT').length;
        const printedSN = r.barcodeReceiptItem.filter((i) => i.printed && i.kind === 'SN').length;
        const printedLOT = r.barcodeReceiptItem.filter((i) => i.printed && i.kind === 'LOT').length;

        return {
          id: r.id,
          code: r.code,
          tax: r.supplierTaxInvoiceNumber,
          purchaseOrderCode: r.purchaseOrder?.code || '-',
          supplier: supplier?.name || '-',
          createdAt: r.createdAt,
          total,
          printed,
          pending,
          // รักษา compatibility: เดิมใช้ชื่อ scanned → แม็ปไปที่ printed
          scanned: printed,
          // ข้อมูลเสริม (optional)
          totalSN,
          totalLOT,
          printedSN,
          printedLOT,
          creditRemaining,
          creditBalance,
        };
      })
      .filter((r) => r.pending > 0);

    return res.json(rows);
  } catch (err) {
    console.error('[getReceiptsWithBarcodes]', err);
    return res.status(500).json({ message: 'ไม่สามารถโหลดรายการใบรับที่รอพิมพ์ได้' });
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
          product: { select: { id: true, name: true } },
        },
      },
      receiptItem: {
        select: {
          purchaseOrderItem: {
            select: {
              productId: true,
              product: { select: { id: true, name: true } },
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
        select: { id: true, name: true },
      });
      productMap = new Map(products.map((p) => [p.id, p]));
    }

    // 🔁 Fallback เพิ่มเติม (ตามเส้นทางที่ระบุ) สำหรับพิมพ์ซ้ำ:
    const receiptPO = await prisma.purchaseOrderReceipt.findFirst({
      where: { id: receiptId, branchId },
      select: { purchaseOrderId: true },
    });

    let poItemMap = new Map();
    let recToPoMap = new Map();

    if (receiptPO?.purchaseOrderId) {
      const poItems = await prisma.purchaseOrderItem.findMany({
        where: { purchaseOrderId: receiptPO.purchaseOrderId },
        select: { id: true, productId: true, product: { select: { id: true, name: true } } },
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

    if (briIds2.length) {
      const briLinks2 = await prisma.barcodeReceiptItem.findMany({
        where: { id: { in: briIds2 }, branchId, stockItemId: { not: null } },
        select: { id: true, stockItem: { select: { id: true, serialNumber: true } } },
      });
      siByBRI = new Map(
        briLinks2
          .map((x) => [x.id, x.stockItem])
          .filter(([k, v]) => k != null && v != null)
      );
    }

    if (recItemIds2.length) {
      const stockItemsByRecItem = await prisma.stockItem.findMany({
        where: { branchId, purchaseOrderReceiptItemId: { in: recItemIds2 } },
        select: { id: true, serialNumber: true, purchaseOrderReceiptItemId: true },
      });
      siByReceiptItem = new Map(
        stockItemsByRecItem
          .map((s) => [s.purchaseOrderReceiptItemId, s])
          .filter(([k, v]) => k != null && v != null)
      );
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

      const productName = p?.name ?? null;
      const productSpec = null;

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

// ---- Audit endpoint: ตรวจสภาพบาร์โค้ดของใบรับ (อ่านอย่างเดียว) ----
// GET /api/barcodes/receipt/:receiptId/audit?includeDetails=1
const auditReceiptBarcodes = async (req, res) => {
  try {
    const receiptId = toInt(req.params?.receiptId);
    const branchId = toInt(req.user?.branchId);
    const includeDetails =
      String(req.query?.includeDetails || '0').toLowerCase() === '1' ||
      String(req.query?.includeDetails || '').toLowerCase() === 'true';

    if (!Number.isInteger(receiptId) || !Number.isInteger(branchId)) {
      return res.status(400).json({ message: 'ต้องระบุ receiptId และต้องมีสิทธิ์สาขา' });
    }

    const receipt = await prisma.purchaseOrderReceipt.findFirst({
      where: { id: receiptId, branchId },
      select: { id: true },
    });
    if (!receipt) {
      return res.status(404).json({ message: 'ไม่พบใบรับในสาขาของคุณ' });
    }

    // 1) โหลดรายการ receipt items
    const recItems = await prisma.purchaseOrderReceiptItem.findMany({
      where: { purchaseOrderReceiptId: receiptId },
      select: { id: true, quantity: true },
    });
    const recItemIds = recItems.map((x) => x.id);

    if (recItemIds.length === 0) {
      return res.json({
        receiptId,
        summary: {
          structured: { items: 0, stockItems: 0, barcodes: 0 },
          simple: { items: 0, simpleLots: 0, barcodes: 0 },
          mixedItems: 0,
          unknownItems: 0,
        },
        anomalies: [],
        details: includeDetails ? [] : undefined,
      });
    }

    // 2) โหลดบาร์โค้ดของใบนี้ทั้งหมด
    const bri = await prisma.barcodeReceiptItem.findMany({
      where: { purchaseOrderReceiptId: receiptId, branchId },
      select: { id: true, barcode: true, receiptItemId: true, stockItemId: true, simpleLotId: true },
    });

    // 3) โหลด StockItem/SimpleLot ผูกกับ receiptItems
    const stockItems = await prisma.stockItem.findMany({
      where: { branchId, purchaseOrderReceiptItemId: { in: recItemIds } },
      select: { id: true, purchaseOrderReceiptItemId: true },
    });
    const simpleLots = await prisma.simpleLot.findMany({
      where: { branchId, receiptItemId: { in: recItemIds } },
      select: { id: true, receiptItemId: true },
    });

    // 4) สร้างแผนที่นับต่อ receiptItem
    const countMap = {
      briByItem: new Map(),
      briSNByItem: new Map(),
      briLOTByItem: new Map(),
      siByItem: new Map(),
      slByItem: new Map(),
      briSamplesByItem: new Map(),
    };

    const inc = (m, k, v = 1) => m.set(k, (m.get(k) || 0) + v);

    for (const b of bri) {
      const k = b.receiptItemId;
      inc(countMap.briByItem, k, 1);
      if (b.stockItemId) inc(countMap.briSNByItem, k, 1);
      if (b.simpleLotId) inc(countMap.briLOTByItem, k, 1);
      const arr = countMap.briSamplesByItem.get(k) || [];
      if (arr.length < 5) arr.push(b.barcode);
      countMap.briSamplesByItem.set(k, arr);
    }

    for (const s of stockItems) inc(countMap.siByItem, s.purchaseOrderReceiptItemId, 1);
    for (const l of simpleLots) inc(countMap.slByItem, l.receiptItemId, 1);

    // 5) สรุปผลต่อใบ + หา anomalies
    let structuredItems = 0,
      structuredStock = 0,
      structuredBarcodes = 0;
    let simpleItems = 0,
      simpleLotsCount = 0,
      simpleBarcodes = 0;
    let mixedItems = 0,
      unknownItems = 0;

    const anomalies = [];
    const addAnomaly = (type, itemId, info) => {
      let an = anomalies.find((a) => a.type === type);
      if (!an) {
        an = { type, count: 0, examples: [] };
        anomalies.push(an);
      }
      an.count += 1;
      if (an.examples.length < 10) an.examples.push({ receiptItemId: itemId, ...info });
    };

    const details = [];

    for (const it of recItems) {
      const id = it.id;
      const si = countMap.siByItem.get(id) || 0;
      const sl = countMap.slByItem.get(id) || 0;
      const briTotal = countMap.briByItem.get(id) || 0;
      const briSN = countMap.briSNByItem.get(id) || 0;
      const briLOT = countMap.briLOTByItem.get(id) || 0;

      const isStructured = si > 0 || briSN > 0;
      const isSimple = sl > 0 || (briLOT > 0 && !isStructured);

      if (isStructured && isSimple) mixedItems += 1;
      if (!isStructured && !isSimple) unknownItems += 1;

      if (isStructured) {
        structuredItems += 1;
        structuredStock += si;
        structuredBarcodes += briTotal;
        if (si > briTotal)
          addAnomaly('STRUCTURED_MISSING_SN_BARCODES', id, {
            stockItems: si,
            barcodes: briTotal,
            samples: countMap.briSamplesByItem.get(id) || [],
          });
        if (briLOT > 0) addAnomaly('STRUCTURED_HAS_LOT_BARCODES', id, { lotBarcodes: briLOT });
      }

      if (isSimple) {
        simpleItems += 1;
        simpleLotsCount += sl;
        simpleBarcodes += briTotal;
        if (sl > 0 && briTotal === 0) addAnomaly('SIMPLE_MISSING_LOT_BARCODES', id, { simpleLots: sl });
        if (sl > 0 && briTotal > sl)
          addAnomaly('SIMPLE_HAS_MULTIPLE_BARCODES', id, {
            simpleLots: sl,
            barcodes: briTotal,
            samples: countMap.briSamplesByItem.get(id) || [],
          });
        if (briSN > 0) addAnomaly('SIMPLE_HAS_SN_BARCODES', id, { snBarcodes: briSN });
      }

      if (includeDetails) {
        details.push({
          receiptItemId: id,
          quantity: Number(it.quantity || 0),
          stockItems: si,
          simpleLots: sl,
          barcodesTotal: briTotal,
          barcodesSN: briSN,
          barcodesLOT: briLOT,
          samples: countMap.briSamplesByItem.get(id) || [],
          flags: {
            isStructured,
            isSimple,
            mixed: isStructured && isSimple,
            unknown: !isStructured && !isSimple,
          },
        });
      }
    }

    return res.json({
      receiptId,
      summary: {
        structured: { items: structuredItems, stockItems: structuredStock, barcodes: structuredBarcodes },
        simple: { items: simpleItems, simpleLots: simpleLotsCount, barcodes: simpleBarcodes },
        mixedItems,
        unknownItems,
      },
      anomalies,
      details: includeDetails ? details : undefined,
    });
  } catch (error) {
    console.error('[auditReceiptBarcodes] ❌', error);
    return res.status(500).json({ message: 'ไม่สามารถตรวจสอบสถานะบาร์โค้ดได้' });
  }
};

// GET /api/barcodes/receipts-ready-to-scan-sn
// รายการใบรับที่มี SN และยังมี SN ที่ไม่ได้ยิงเข้าสต๊อก (stockItemId=null)
const getReceiptsReadyToScanSN = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    if (!Number.isInteger(branchId)) {
      return res.status(400).json({ message: 'ต้องมี branchId' });
    }

    const receipts = await prisma.purchaseOrderReceipt.findMany({
      where: {
        branchId,
        barcodeReceiptItem: { some: { OR: [{ kind: 'SN' }, { stockItemId: { not: null } }] } },
      },
      include: {
        purchaseOrder: { select: { code: true, supplier: { select: { name: true } } } },
        barcodeReceiptItem: { select: { kind: true, stockItemId: true, simpleLotId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const rows = receipts
      .map((r) => {
        const isSN = (i) => i.kind === 'SN' || (i.stockItemId != null && !i.simpleLotId);
        const totalSN = r.barcodeReceiptItem.filter(isSN).length;
        const scannedSN = r.barcodeReceiptItem.filter((i) => isSN(i) && i.stockItemId != null).length;
        const pendingSN = Math.max(0, totalSN - scannedSN);
        return {
          id: r.id,
          code: r.code,
          purchaseOrderCode: r.purchaseOrder?.code || '-',
          supplier: r.purchaseOrder?.supplier?.name || '-',
          createdAt: r.createdAt,
          totalSN,
          scannedSN,
          pendingSN,
        };
      })
      .filter((r) => r.pendingSN > 0);

    return res.json(rows);
  } catch (err) {
    console.error('[getReceiptsReadyToScanSN] ❌', err);
    return res.status(500).json({ message: 'ไม่สามารถโหลดรายการที่พร้อมยิง SN ได้' });
  }
};

// GET /api/barcodes/receipts-ready-to-scan (รวม SN/LOT)
// ดึงใบที่ยังมี SN ค้างยิง หรือ LOT ที่ยังไม่ ACTIVATE
const getReceiptsReadyToScan = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    if (!Number.isInteger(branchId)) {
      return res.status(400).json({ message: 'ต้องมี branchId' });
    }

    const receipts = await prisma.purchaseOrderReceipt.findMany({
      where: { branchId, barcodeReceiptItem: { some: {} } },
      include: {
        purchaseOrder: { select: { code: true, supplier: { select: { name: true } } } },
        barcodeReceiptItem: { select: { kind: true, stockItemId: true, simpleLotId: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const rows = receipts
      .map((r) => {
        const items = r.barcodeReceiptItem || [];
        const isSN = (i) => i.kind === 'SN' || (i.stockItemId != null && !i.simpleLotId);
        const isLOT = (i) => i.kind === 'LOT' || i.simpleLotId != null;

        const totalSN = items.filter(isSN).length;
        const scannedSN = items.filter((i) => isSN(i) && i.stockItemId != null).length;
        const pendingSN = Math.max(0, totalSN - scannedSN);

        const totalLOT = items.filter(isLOT).length;
        const activatedLOT = items.filter((i) => isLOT(i) && i.status === 'SN_RECEIVED').length;
        const pendingLOT = Math.max(0, totalLOT - activatedLOT);

        const pendingTotal = pendingSN + pendingLOT;

        return {
          id: r.id,
          code: r.code,
          purchaseOrderCode: r.purchaseOrder?.code || '-',
          supplier: r.purchaseOrder?.supplier?.name || '-',
          createdAt: r.createdAt,
          totalSN,
          scannedSN,
          pendingSN,
          totalLOT,
          activatedLOT,
          pendingLOT,
          pendingTotal,
        };
      })
      .filter((r) => r.pendingTotal > 0);

    return res.json(rows);
  } catch (err) {
    console.error('[getReceiptsReadyToScan] ❌', err);
    return res.status(500).json({ message: 'ไม่สามารถโหลดรายการใบที่พร้อมยิง/เปิดล็อตได้' });
  }
};

module.exports = {
  generateMissingBarcodes,
  getBarcodesByReceiptId,
  getReceiptsWithBarcodes,
  reprintBarcodes,
  searchReprintReceipts,
  markReceiptAsCompleted,
  markBarcodesAsPrinted,
  auditReceiptBarcodes,
  getReceiptsReadyToScanSN,
  getReceiptsReadyToScan,
};
