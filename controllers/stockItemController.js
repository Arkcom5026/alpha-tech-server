


// ✅ StockItemController.js — จัดการ SN/Barcode และรายการสินค้าเข้าสต๊อก (มาตรฐาน Prisma singleton + Branch scope + Decimal-safe)
const { prisma, Prisma } = require('../lib/prisma');

// Helpers
const D = (v) => (v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v ?? 0));
const toNum = (v) => (v && typeof v.toNumber === 'function' ? v.toNumber() : Number(v ?? 0));
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

// POST /stock-items/from-receipt
const addStockItemFromReceipt = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    const {
      receiptItemId,
      productId,
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
      checkedBy,
    } = req.body || {};

    if (!branchId) return res.status(401).json({ message: 'Unauthorized: missing branch context' });
    if (!receiptItemId || !productId || !barcode) {
      return res.status(400).json({ message: 'Missing required fields (receiptItemId, productId, barcode)' });
    }

    // ตรวจสอบ receiptItem และสิทธิ์สาขา + mapping product ที่ถูกต้อง
    const recItem = await prisma.purchaseOrderReceiptItem.findFirst({
      where: { id: Number(receiptItemId), receipt: { branchId } },
      include: {
        receipt: true,
        purchaseOrderItem: { include: { product: true } },
      },
    });
    if (!recItem) return res.status(404).json({ message: 'ไม่พบรายการรับสินค้านี้ในสาขา' });
    if (recItem.purchaseOrderItem?.productId !== Number(productId)) {
      return res.status(400).json({ message: 'productId ไม่ตรงกับสินค้าในใบสั่งซื้อ' });
    }

    // กัน barcode ซ้ำ (สมมติคีย์ unique ที่ stockItem.barcode)
    const dup = await prisma.stockItem.findUnique({ where: { barcode: String(barcode) } });
    if (dup) return res.status(400).json({ message: 'Barcode นี้ถูกใช้แล้ว' });

    const created = await prisma.stockItem.create({
      data: {
        barcode: String(barcode),
        serialNumber: serialNumber || String(barcode),
        qrCodeData: qrCodeData || null,
        warrantyDays: toInt(warrantyDays) || null,
        expiredAt: expiredAt ? new Date(expiredAt) : null,
        remark: remark || null,
        locationCode: locationCode || null,
        source: source || 'PURCHASE_ORDER',
        tag: tag || null,
        batchNumber: batchNumber || null,
        checkedBy: checkedBy || null,
        status: 'IN_STOCK',
        receivedAt: new Date(),
        costPrice: D(recItem.costPrice || 0),
        product: { connect: { id: Number(productId) } },
        branch: { connect: { id: branchId } },
        purchaseOrderReceiptItem: { connect: { id: Number(receiptItemId) } },
      },
    });

    return res.status(201).json(created);
  } catch (error) {
    console.error('[addStockItemFromReceipt] ❌', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /stock-items/by-receipt/:receiptId
const getStockItemsByReceipt = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    const receiptId = toInt(req.params?.receiptId);
    if (!branchId) return res.status(401).json({ message: 'unauthorized' });
    if (!receiptId) return res.status(400).json({ message: 'receiptId ไม่ถูกต้อง' });

    const receipt = await prisma.purchaseOrderReceipt.findFirst({ where: { id: receiptId, branchId } });
    if (!receipt) return res.status(404).json({ message: 'ไม่พบใบรับสินค้านี้ในสาขา' });

    const receiptItems = await prisma.purchaseOrderReceiptItem.findMany({
      where: { receiptId },
      include: {
        purchaseOrderItem: { include: { product: true } },
        stockItems: true,
      },
      orderBy: { id: 'asc' },
    });

    return res.json(receiptItems);
  } catch (error) {
    console.error('[getStockItemsByReceipt] ❌', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /stock-items/by-receipts (body: { receiptIds: number[] })
const getStockItemsByReceiptIds = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    const { receiptIds } = req.body || {};

    if (!branchId) return res.status(401).json({ message: 'unauthorized' });
    if (!Array.isArray(receiptIds) || receiptIds.length === 0) {
      return res.status(400).json({ message: 'receiptIds ต้องเป็น array ที่ไม่ว่าง' });
    }
    const ids = receiptIds.map((x) => Number(x)).filter(Number.isFinite);

    const receiptItems = await prisma.purchaseOrderReceiptItem.findMany({
      where: { receiptId: { in: ids }, receipt: { branchId } },
      include: {
        purchaseOrderItem: { include: { product: true } },
        receipt: { include: { purchaseOrder: { include: { supplier: true } } } },
        stockItems: true,
      },
      orderBy: { id: 'asc' },
    });

    return res.json(receiptItems);
  } catch (error) {
    console.error('[getStockItemsByReceiptIds] ❌', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE /stock-items/:id
const deleteStockItem = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    const id = toInt(req.params?.id);
    if (!branchId) return res.status(401).json({ message: 'unauthorized' });
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const found = await prisma.stockItem.findFirst({
      where: { id, branchId },
      include: { saleItem: true },
    });
    if (!found) return res.status(404).json({ message: 'ไม่พบรายการในสาขา' });
    if (found.status !== 'IN_STOCK' || found.saleItem) {
      return res.status(409).json({ message: 'ลบไม่ได้: สถานะไม่ใช่ IN_STOCK หรือมีการอ้างอิงการขายแล้ว' });
    }

    const deleted = await prisma.stockItem.delete({ where: { id } });
    return res.json(deleted);
  } catch (error) {
    console.error('[deleteStockItem] ❌', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// PATCH /stock-items/:id/status
const updateStockItemStatus = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    const id = toInt(req.params?.id);
    const { status } = req.body || {};
    if (!branchId) return res.status(401).json({ message: 'unauthorized' });
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const validStatus = ['IN_STOCK', 'SOLD', 'CLAIMED', 'LOST'];
    if (!validStatus.includes(status)) {
      return res.status(400).json({ message: 'สถานะไม่ถูกต้อง' });
    }
    if (status === 'SOLD') {
      return res.status(400).json({ message: 'กรุณาใช้ endpoint markStockItemsAsSold สำหรับการขาย' });
    }

    const exists = await prisma.stockItem.findFirst({ where: { id, branchId } });
    if (!exists) return res.status(404).json({ message: 'ไม่พบรายการในสาขา' });

    const updated = await prisma.stockItem.update({ where: { id }, data: { status } });
    return res.json(updated);
  } catch (error) {
    console.error('[updateStockItemStatus] ❌', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /stock-items/mark-sold  { stockItemIds: number[] }
// ✅ Production hardening:
// - อัปเดตได้เฉพาะรายการที่อยู่ในสาขาเดียวกัน และต้องเป็น IN_STOCK เท่านั้น
// - ถ้าอัปเดตไม่ครบ (มีบางรายการถูกขายไปแล้ว/ไม่พบ/ไม่ใช่ IN_STOCK) → ตอบ 409 พร้อมรายละเอียด
const markStockItemsAsSold = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    const { stockItemIds } = req.body || {};
    if (!branchId) return res.status(401).json({ message: 'unauthorized' });

    if (!Array.isArray(stockItemIds) || stockItemIds.length === 0) {
      return res.status(400).json({ message: 'stockItemIds ต้องเป็น array' });
    }

    // normalize + unique
    const ids = [...new Set(stockItemIds.map((x) => Number(x)).filter(Number.isFinite))];
    if (ids.length === 0) {
      return res.status(400).json({ message: 'stockItemIds ไม่ถูกต้อง' });
    }

    // ✅ ตรวจสอบก่อน: ต้องอยู่ในสาขา + ต้องเป็น IN_STOCK
    const existing = await prisma.stockItem.findMany({
      where: { id: { in: ids }, branchId },
      select: { id: true, status: true },
    });

    const existingMap = new Map(existing.map((x) => [x.id, x]));
    const notFoundIds = ids.filter((id) => !existingMap.has(id));
    const notInStock = existing.filter((x) => x.status !== 'IN_STOCK');

    if (notFoundIds.length > 0 || notInStock.length > 0) {
      return res.status(409).json({
        code: 'STOCK_ITEMS_NOT_SELLABLE',
        message: 'อัปเดตสถานะเป็น SOLD ไม่ครบ: มีบางรายการไม่อยู่ในสาขา/ไม่พบ หรือสถานะไม่ใช่ IN_STOCK',
        notFoundIds,
        notSellable: notInStock.map((x) => ({ id: x.id, status: x.status })),
      });
    }

    // ✅ ทำงานแบบ transactional เพื่อให้ตอบผลลัพธ์ consistent
    const now = new Date();
    const updated = await prisma.stockItem.updateMany({
      where: { id: { in: ids }, branchId, status: 'IN_STOCK' },
      data: { status: 'SOLD', soldAt: now },
    });

    // guard: ถ้ามี race condition (มีคนขายตัดหน้า) จะทำให้ count ไม่ครบ
    if (updated.count !== ids.length) {
      // re-check หลัง update เพื่อบอกเหตุผล
      const after = await prisma.stockItem.findMany({
        where: { id: { in: ids }, branchId },
        select: { id: true, status: true },
      });
      const afterMap = new Map(after.map((x) => [x.id, x.status]));
      const failed = ids
        .filter((id) => afterMap.get(id) !== 'SOLD')
        .map((id) => ({ id, status: afterMap.get(id) || 'NOT_FOUND' }));

      return res.status(409).json({
        code: 'STOCK_ITEMS_SOLD_PARTIAL',
        message: 'อัปเดตสถานะเป็น SOLD ไม่ครบ (อาจมีการขายซ้ำ/สถานะเปลี่ยนระหว่างทำรายการ)',
        updatedCount: updated.count,
        expectedCount: ids.length,
        failed,
      });
    }

    return res.status(200).json({ count: updated.count });
  } catch (err) {
    console.error('❌ [markStockItemsAsSold] error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /stock-items/receive-sn  { barcode: { barcode, serialNumber? } }
// หมายเหตุ: รองรับทั้ง SN (STRUCTURED) และ LOT (SIMPLE)
// - SN: สร้าง/ผูก StockItem(IN_STOCK) ต่อชิ้น + อัปเดตเครดิตตามต้นทุน/ชิ้น
// - LOT: เปลี่ยนสถานะบาร์โค้ดล็อตเป็น SN_RECEIVED (พร้อมขายสำหรับ LOT) + อัปเดตเครดิตรวมตามจำนวนรับ
const receiveStockItem = async (req, res) => {
  try {
    const branchIdFromUser = toInt(req.user?.branchId);
    const { barcode: barcodeData } = req.body || {};

    if (!branchIdFromUser) return res.status(401).json({ error: 'unauthorized' });
    if (!barcodeData || typeof barcodeData !== 'object') {
      return res.status(400).json({ error: 'Invalid barcode payload.' });
    }

    const { barcode, serialNumber } = barcodeData;
    if (!barcode || typeof barcode !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid barcode.' });
    }

    const barcodeItem = await prisma.barcodeReceiptItem.findUnique({
      where: { barcode: String(barcode) },
      include: {
        receiptItem: {
          include: {
            receipt: true,
            purchaseOrderItem: {
              include: {
                product: true,
                purchaseOrder: { include: { supplier: true } },
              },
            },
          },
        },
      },
    });

    if (!barcodeItem) return res.status(404).json({ error: 'Barcode not found.' });

    const product = barcodeItem.receiptItem?.purchaseOrderItem?.product;
    const purchaseOrder = barcodeItem.receiptItem?.purchaseOrderItem?.purchaseOrder;
    if (!product || !purchaseOrder) {
      return res.status(400).json({ error: 'Product or PO data missing.' });
    }

    const branchId = toInt(barcodeItem.receiptItem?.receipt?.branchId);
    if (!branchId || branchId !== branchIdFromUser) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์รับสินค้าของสาขาอื่น' });
    }

    const isLOT = (barcodeItem.kind === 'LOT') || (barcodeItem.simpleLotId != null);
    const isSN = !isLOT; // บาร์โค้ดที่ไม่ใช่ LOT ถือเป็น SN

    // LOT: activate lot (ไม่สร้าง StockItem รายชิ้น)
    if (isLOT) {
      if (barcodeItem.status === 'SN_RECEIVED') {
        return res.status(200).json({ message: 'LOT already scanned', lot: { barcode: barcodeItem.barcode, receiptItemId: barcodeItem.receiptItemId, quantity: toInt(barcodeItem.receiptItem?.quantity) || 0 } });
      }

      const qty = toInt(barcodeItem.receiptItem?.quantity) || 0;
      const unitCost = D(barcodeItem.receiptItem?.costPrice || 0);
      const totalCostDec = unitCost.times(qty || 1);

      const result = await prisma.$transaction(async (tx) => {
        // เปลี่ยนสถานะล็อตเป็น SN_RECEIVED (พร้อมขายสำหรับ LOT)
        const updatedBRI = await tx.barcodeReceiptItem.update({
          where: { barcode: String(barcode) },
          data: { status: 'SN_RECEIVED' },
        });

        // 2) อัปเดตสต๊อกคงเหลือ (StockBalance) ตามจำนวนในใบรับ
        await tx.stockBalance.upsert({
          where: { productId_branchId: { productId: product.id, branchId } },
          update: { quantity: { increment: qty } },
          create: { productId: product.id, branchId, quantity: qty, reserved: 0 },
        });

        // 3) เพิ่มเครดิตซัพพลายเออร์ (ถ้าไม่ใช่ system)
        const isSystemSupplier = Boolean(purchaseOrder?.supplier?.isSystem);
        if (!isSystemSupplier && totalCostDec.gt(0)) {
          await tx.supplier.update({
            where: { id: purchaseOrder.supplierId },
            data: { creditBalance: D(purchaseOrder.supplier.creditBalance || 0).plus(totalCostDec) },
          });
        }

        return { updatedBRI };
      }, { timeout: 20000 });

      return res.status(200).json({
        message: '✅ LOT scanned and ready to sell.',
        lot: {
          barcode: barcodeItem.barcode,
          receiptItemId: barcodeItem.receiptItemId,
          quantity: qty,
        },
        result,
      });
    }

    // SN: ตรวจซ้ำ + สร้าง StockItem รายชิ้น
    if (barcodeItem.stockItemId) return res.status(200).json({ message: 'Item already received', stockItemId: barcodeItem.stockItemId });

    // กัน barcode ซ้ำใน stockItem อีกชั้น
    const dup = await prisma.stockItem.findUnique({ where: { barcode: String(barcode) } });
    if (dup) return res.status(400).json({ error: 'This barcode already exists in stockItem.' });

    const newStockItem = await prisma.$transaction(async (tx) => {
      const created = await tx.stockItem.create({
        data: {
          barcode: String(barcode),
          serialNumber: serialNumber || String(barcode),
          status: 'IN_STOCK',
          receivedAt: new Date(),
          costPrice: D(barcodeItem.receiptItem?.costPrice || 0),
          product: { connect: { id: product.id } },
          branch: { connect: { id: branchId } },
          purchaseOrderReceiptItem: { connect: { id: barcodeItem.receiptItem.id } },
        },
      });

      await tx.barcodeReceiptItem.update({ where: { barcode: String(barcode) }, data: { stockItemId: created.id } });

      // อัปเดต StockBalance +1 สำหรับ SN
      await tx.stockBalance.upsert({
        where: { productId_branchId: { productId: product.id, branchId } },
        update: { quantity: { increment: 1 } },
        create: { productId: product.id, branchId, quantity: 1, reserved: 0 },
      });

      // เพิ่มเครดิตเจ้าหนี้ต่อชิ้น
      const isSystemSupplier = Boolean(purchaseOrder?.supplier?.isSystem);
      const totalCostDec = D(barcodeItem.receiptItem?.costPrice || 0).times(1);
      if (!isSystemSupplier && totalCostDec.gt(0)) {
        await tx.supplier.update({
          where: { id: purchaseOrder.supplierId },
          data: { creditBalance: D(purchaseOrder.supplier.creditBalance || 0).plus(totalCostDec) },
        });
      }

      return created;
    }, { timeout: 20000 });

    return res.status(201).json({ message: '✅ รับสินค้าเข้าสต๊อกเรียบร้อยแล้ว', stockItem: newStockItem });
  } catch (error) {
    console.error('[receiveStockItem] ❌ Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// GET /stock-items/search?query=...
// - ค้นหาในสาขาปัจจุบัน
// - รองรับการแจ้งเตือน "ขายแล้ว/ไม่พร้อมขาย" แบบชัดเจน:
//   * ถ้า query เป็น barcode/SN แบบ exact แล้วเจอ แต่ status != IN_STOCK → ตอบ 409 พร้อม status
//   * ถ้าไม่เจอเลย → ตอบ 404
//   * ถ้าเป็นการค้นหาชื่อ/รุ่น → คืนเฉพาะ IN_STOCK ตามเดิม
const searchStockItem = async (req, res) => {
  try {
    const query = (req.query.query || req.query.barcode || '').toString().trim();
    const branchId = toInt(req.user?.branchId);
    if (!query || !branchId) return res.status(400).json({ error: 'Missing query or branchId' });

    // ✅ 1) Exact match (barcode / serialNumber) แบบไม่กรอง status เพื่อแยกเคส SOLD ได้
    const exact = await prisma.stockItem.findFirst({
      where: {
        branchId,
        OR: [
          { barcode: { equals: query } },
          { serialNumber: { equals: query } },
        ],
      },
      include: { product: true },
    });

    if (exact) {
      if (exact.status !== 'IN_STOCK') {
        return res.status(409).json({
          code: 'BARCODE_NOT_SELLABLE',
          status: exact.status,
          message: `สินค้านี้ไม่พร้อมขาย (สถานะ: ${exact.status})`,
        });
      }

      // exact พร้อมขาย → คืนเป็น array 1 ตัว (คงรูปแบบเดิมให้ FE)
      const bp = await prisma.branchPrice.findFirst({
        where: { branchId, productId: exact.productId },
        select: { productId: true, priceRetail: true, priceWholesale: true, priceTechnician: true, priceOnline: true },
      });

      return res.json([
        {
          ...exact,
          prices: {
            retail: toNum(bp?.priceRetail),
            wholesale: toNum(bp?.priceWholesale),
            technician: toNum(bp?.priceTechnician),
            online: toNum(bp?.priceOnline),
          },
        },
      ]);
    }

    // ✅ 2) ไม่ใช่ exact barcode/SN → ค้นหาแบบเดิม (เฉพาะ IN_STOCK)
    const stockItems = await prisma.stockItem.findMany({
      where: {
        status: 'IN_STOCK',
        branchId,
        OR: [
          { product: { name: { contains: query, mode: 'insensitive' } } },
          { product: { model: { contains: query, mode: 'insensitive' } } },
        ],
      },
      include: { product: true },
      orderBy: { id: 'asc' },
      take: 20,
    });

    if (!stockItems || stockItems.length === 0) {
      return res.status(404).json({ code: 'BARCODE_NOT_FOUND', message: 'ไม่พบบาร์โค้ด/สินค้าในระบบ' });
    }

    // ดึง branchPrices ครั้งเดียวแบบ batch แล้วแมปกลับ
    const productIds = [...new Set(stockItems.map((i) => i.productId))];
    const branchPrices = await prisma.branchPrice.findMany({
      where: { branchId, productId: { in: productIds } },
      select: { productId: true, priceRetail: true, priceWholesale: true, priceTechnician: true, priceOnline: true },
    });
    const priceMap = new Map(branchPrices.map((bp) => [bp.productId, bp]));

    const result = stockItems.map((item) => {
      const bp = priceMap.get(item.productId);
      return {
        ...item,
        prices: {
          retail: toNum(bp?.priceRetail),
          wholesale: toNum(bp?.priceWholesale),
          technician: toNum(bp?.priceTechnician),
          online: toNum(bp?.priceOnline),
        },
      };
    });

    return res.json(result);
  } catch (err) {
    console.error('❌ [searchStockItem] error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาสินค้า' });
  }
};

// PATCH /stock-items/:barcode/serial-number
const updateSerialNumber = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    const { barcode } = req.params || {};
    const { serialNumber } = req.body || {};

    if (!branchId) return res.status(401).json({ error: 'unauthorized' });
    if (!barcode) return res.status(400).json({ error: 'Missing barcode.' });

    const stockItem = await prisma.stockItem.findFirst({ where: { barcode: String(barcode), branchId } });
    if (!stockItem) return res.status(404).json({ error: 'Stock item not found.' });
    if (stockItem.branchId !== branchId) return res.status(403).json({ error: 'ไม่มีสิทธิ์แก้ไขสินค้าของสาขาอื่น' });

    if (serialNumber) {
      const duplicate = await prisma.stockItem.findFirst({ where: { serialNumber: String(serialNumber), NOT: { id: stockItem.id } } });
      if (duplicate) return res.status(400).json({ error: 'SN นี้ถูกใช้ไปแล้วกับสินค้ารายการอื่น' });
    }

    const updated = await prisma.stockItem.update({
      where: { id: stockItem.id },
      data: { serialNumber: serialNumber || null },
      include: { purchaseOrderReceiptItem: { select: { receiptId: true } } },
    });

    return res.json({ message: 'SN updated', stockItem: updated });
  } catch (error) {
    console.error('[updateSerialNumber] ❌ Error:', error);
    return res.status(500).json({ error: 'Failed to update serial number.' });
  }
};

// GET /stock-items/available?productId=...
const getAvailableStockItemsByProduct = async (req, res) => {
  try {
    const productId = toInt(req.query?.productId);
    const branchId = toInt(req.user?.branchId);

    if (!productId || !branchId) {
      return res.status(400).json({ error: 'ต้องระบุ productId และอยู่ภายใต้ branch ที่ล็อกอิน' });
    }

    const items = await prisma.stockItem.findMany({
      where: { productId, branchId, status: 'IN_STOCK' },
      orderBy: { receivedAt: 'asc' },
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
            productProfile: { select: { name: true } },
            productType: { select: { name: true } },
            category: { select: { name: true } },
            unit: { select: { name: true } },
          },
        },
      },
    });

    return res.json(items);
  } catch (error) {
    console.error('[getAvailableStockItemsByProduct] ❌', error);
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






