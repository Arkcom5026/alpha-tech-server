// purchaseOrderReceiptController.js

const dayjs = require('dayjs');
const { ReceiptStatus, Prisma } = require('@prisma/client');
const { prisma } = require('../lib/prisma');

const D = (v) => new Prisma.Decimal(typeof v === 'string' ? v : Number(v));
const toNum = (v) => (v && typeof v === 'object' && 'toNumber' in v ? v.toNumber() : Number(v));
const NORMALIZE_DECIMAL_TO_NUMBER = process.env.NORMALIZE_DECIMAL_TO_NUMBER !== '0';

// ────────────────────────────────────────────────────────────────────────────────
// Helpers for Step 4 (Finalize logic)
// ────────────────────────────────────────────────────────────────────────────────
const isLotRow = (row) => row?.kind === 'LOT' || row?.simpleLotId != null;
const isSnRow = (row) => row?.kind === 'SN' || !row?.simpleLotId;

async function getReceiptPendingCounts(client, receiptId) {
  const rows = await client.barcodeReceiptItem.findMany({
    where: { receiptItem: { receiptId } },
    select: { id: true, kind: true, status: true, stockItemId: true, simpleLotId: true },
  });
  let pendingSN = 0;
  let pendingLOT = 0;
  for (const r of rows) {
    if (isLotRow(r)) {
      if ((r.status || null) !== 'SN_RECEIVED') pendingLOT += 1;
    } else {
      if (r.stockItemId == null) pendingSN += 1;
    }
  }
  return { pendingSN, pendingLOT, total: rows.length };
}

async function computePoStatus(client, purchaseOrderId) {
  const rows = await client.barcodeReceiptItem.findMany({
    where: { receiptItem: { receipt: { purchaseOrderId } } },
    select: { kind: true, status: true, stockItemId: true, simpleLotId: true },
  });
  if (rows.length === 0) return 'PENDING';
  const total = rows.length;
  const done = rows.filter((r) => (isLotRow(r) ? r.status === 'SN_RECEIVED' : r.stockItemId != null)).length;
  if (done === 0) return 'PENDING';
  if (done < total) return 'PARTIALLY_RECEIVED';
  return 'COMPLETED';
}

const generateReceiptCode = async (branchId, client) => {
  const paddedBranch = String(branchId).padStart(2, '0');
  const now = dayjs();
  const prefix = `RC-${paddedBranch}${now.format('YYMM')}`;

  const latest = await client.purchaseOrderReceipt.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });

  let nextNumber = 1;
  if (latest?.code) {
    const lastSequence = parseInt(latest.code.split('-').pop(), 10);
    nextNumber = (isNaN(lastSequence) ? 0 : lastSequence) + 1;
  }
  const running = String(nextNumber).padStart(4, '0');
  return `${prefix}-${running}`;
};


// ---- Create Receipt (small tx + retry on code collision) ----
const createPurchaseOrderReceipt = async (req, res) => {
  try {
    const purchaseOrderId = Number(req.body.purchaseOrderId);
    const note = req.body.note || null;
    const supplierTaxInvoiceNumber = req.body.supplierTaxInvoiceNumber || null;
    const supplierTaxInvoiceDate = req.body.supplierTaxInvoiceDate || null;
    const receivedAt = req.body.receivedAt ? new Date(req.body.receivedAt) : new Date();

    const branchId = Number(req.user?.branchId);
    const employeeId = Number(req.user?.employeeId);

    if (!purchaseOrderId || !branchId || !employeeId) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบ (purchaseOrderId/branchId/employeeId)' });
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: {
        id: true,
        branchId: true,
        code: true,
        supplier: { select: { name: true } },
        items: { select: { productId: true, costPrice: true } },
      },
    });
    if (!po || Number(po.branchId) !== branchId) {
      return res.status(404).json({ error: 'ไม่พบใบสั่งซื้อในสาขานี้' });
    }

    const maxRetries = 3;
    let created = null;

    await prisma.$transaction(
      async (tx) => {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const code = await generateReceiptCode(branchId, tx);
          try {
            const taxDate = supplierTaxInvoiceDate ? new Date(supplierTaxInvoiceDate) : null;
            created = await tx.purchaseOrderReceipt.create({
              data: {
                note,
                code,
                supplierTaxInvoiceNumber,
                supplierTaxInvoiceDate: taxDate,
                receivedAt, // ✅ บันทึกวันที่รับจริง
                branch: { connect: { id: branchId } },
                purchaseOrder: { connect: { id: purchaseOrderId } },
                receivedBy: { connect: { id: employeeId } }, // ✅ ใช้ relation แทน receivedById
              },
              include: {
                purchaseOrder: {
                  select: {
                    id: true,
                    code: true,
                    supplier: { select: { name: true } },
                    items: { select: { productId: true, costPrice: true } },
                  },
                },
              },
            });
            break;
          } catch (err) {
            if (err?.code === 'P2002' && String(err?.meta?.target).includes('code') && attempt < maxRetries - 1) {
              continue;
            }
            throw err;
          }
        }

        if (!created) throw new Error('สร้างรหัสใบรับสินค้าแบบไม่ซ้ำไม่สำเร็จ');
      },
      { timeout: 20000, maxWait: 8000 }
    );

    for (const it of po.items) {
      try {
        await prisma.branchPrice.upsert({
          where: { productId_branchId: { productId: it.productId, branchId } },
          update: { costPrice: it.costPrice },
          create: { productId: it.productId, branchId, costPrice: it.costPrice },
        });
      } catch (e) {
        console.warn('[createPurchaseOrderReceipt] upsert branchPrice warning:', e?.message || e);
      }
    }

    return res.status(201).json(created);
  } catch (error) {
    console.error('❌ [createPurchaseOrderReceipt] error:', error);
    return res.status(500).json({ error: 'สร้างใบรับสินค้าไม่สำเร็จ' });
  }
};


// ---- List Receipts ---- แสดงรายการใบตรวจรับรอยิงบาร์โค้ด (พร้อม Supplier และตัวกรอง printed)
const getAllPurchaseOrderReceipts = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    // ใช้เฉพาะคิว "ยังไม่ได้พิมพ์" เท่านั้น (unprinted queue)
    const receipts = await prisma.purchaseOrderReceipt.findMany({
      where: { branchId, printed: false },
      select: {
        id: true,
        code: true,
        receivedAt: true,
        printed: true,
        purchaseOrder: {
          select: {
            code: true,
            supplier: { select: { name: true } },
          },
        },
      },
      orderBy: { receivedAt: 'desc' },
    });

    // flatten ให้ง่ายต่อการใช้ที่ FE
    const items = receipts.map((r) => ({
      id: r.id,
      receiptCode: r.code,
      poCode: r.purchaseOrder?.code || '-',
      supplierName: r.purchaseOrder?.supplier?.name || '-',
      receivedAt: r.receivedAt,
      printed: r.printed,
    }));

    console.log('[getAllPurchaseOrderReceipts] (unprinted only) count:', items.length);
    return res.json(items);
  } catch (error) {
    console.error('❌ [getAllPurchaseOrderReceipts] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถโหลดรายการใบรับสินค้าได้' });
  }
};



// ---- Get Receipt by ID (with supplier debitAmount) ----
const getPurchaseOrderReceiptById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const branchId = Number(req.user?.branchId);
    if (!id) return res.status(400).json({ error: 'Missing or invalid receipt ID' });
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    const receipt = await prisma.purchaseOrderReceipt.findFirst({
      where: { id, branchId },
      include: {
        items: {
          select: {
            id: true,
            quantity: true,
            purchaseOrderItem: {
              select: {
                product: {
                  select: {
                    name: true,
                    template: { select: { unit: { select: { name: true } } } },
                  },
                },
              },
            },
          },
        },
        purchaseOrder: {
          select: {
            id: true,
            code: true,
            supplier: {
              select: {
                id: true,
                name: true,
                creditLimit: true,
                creditBalance: true,
              },
            },
          },
        },
      },
    });

    if (!receipt) return res.status(404).json({ error: 'ไม่พบใบรับสินค้านี้' });
    if (!receipt.purchaseOrder?.id) return res.status(400).json({ error: 'ไม่พบข้อมูลใบสั่งซื้อของใบรับนี้' });

    // Sum total paid across all receipts of the same PO
    const allReceiptIds = (
      await prisma.purchaseOrderReceipt.findMany({
        where: { purchaseOrderId: receipt.purchaseOrder.id },
        select: { id: true },
      })
    ).map((r) => r.id);

    let totalPaid = new Prisma.Decimal(0);
    if (allReceiptIds.length) {
      const links = await prisma.supplierPaymentReceipt.findMany({
        where: { receiptId: { in: allReceiptIds } },
        select: { amountPaid: true },
      });
      totalPaid = links.reduce((sum, r) => sum.plus(r.amountPaid), new Prisma.Decimal(0));
    }

    const formatted = {
      ...receipt,
      items: receipt.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        productName: item.purchaseOrderItem.product.name,
        unitName: item.purchaseOrderItem.product.template?.unit?.name || 'N/A',
      })),
    };

    const supplierOut = { ...receipt.purchaseOrder.supplier };
    if (NORMALIZE_DECIMAL_TO_NUMBER) {
      for (const k of ['creditLimit', 'creditBalance']) {
        if (supplierOut[k]?.toNumber) supplierOut[k] = supplierOut[k].toNumber();
      }
    }

    const response = {
      ...formatted,
      purchaseOrder: {
        ...formatted.purchaseOrder,
        supplier: {
          ...supplierOut,
          debitAmount: NORMALIZE_DECIMAL_TO_NUMBER ? toNum(totalPaid) : totalPaid,
        },
      },
    };

    res.set('Cache-Control', 'no-store');
    return res.json(response);
  } catch (error) {
    console.error('❌ [getPurchaseOrderReceiptById] error:', error);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาด ไม่สามารถดึงข้อมูลใบรับสินค้าได้' });
  }
};

// ---- Get Purchase Order (with received qty) ----
const getPurchaseOrderDetailById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    const purchaseOrder = await prisma.purchaseOrder.findFirst({
      where: { id, branchId },
      include: {
        supplier: true,
        items: { include: { product: true, receiptItems: true } },
      },
    });

    if (!purchaseOrder) return res.status(404).json({ error: 'ไม่พบใบสั่งซื้อนี้' });

    const itemsWithReceived = purchaseOrder.items.map((item) => {
      const receivedQuantity = item.receiptItems?.reduce((sum, r) => sum + r.quantity, 0) || 0;
      return { ...item, receivedQuantity };
    });


    return res.json({ ...purchaseOrder, items: itemsWithReceived });
  } catch (error) {
    console.error('❌ [getPurchaseOrderDetailById] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลใบสั่งซื้อได้' });
  }
};


// ---- Update note ----
const updatePurchaseOrderReceipt = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    const found = await prisma.purchaseOrderReceipt.findFirst({ where: { id, branchId } });
    if (!found) return res.status(404).json({ error: 'ไม่พบใบรับสินค้านี้' });

    const updated = await prisma.purchaseOrderReceipt.update({
      where: { id },
      data: { note: req.body.note || null },
      include: {
        purchaseOrder: { select: { code: true, supplier: { select: { name: true } } } },
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error('❌ [updatePurchaseOrderReceipt] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถแก้ไขใบรับสินค้าได้' });
  }
};

// ---- Delete receipt ----
const deletePurchaseOrderReceipt = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    const found = await prisma.purchaseOrderReceipt.findFirst({ where: { id, branchId } });
    if (!found) return res.status(404).json({ error: 'ไม่พบใบรับสินค้านี้' });

    await prisma.purchaseOrderReceipt.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error('❌ [deletePurchaseOrderReceipt] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถลบใบรับสินค้าได้' });
  }
};

// ---- Barcode summaries ----
const getReceiptBarcodeSummaries = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    // Support query filter ?printed=true/false (case-insensitive); undefined = no filter
    const printedParam = typeof req.query?.printed === 'string' ? req.query.printed.toLowerCase() : undefined;
    const printedFilter = printedParam === 'true' ? true : printedParam === 'false' ? false : undefined;

    const receipts = await prisma.purchaseOrderReceipt.findMany({
      where: { branchId, printed: printedFilter },
      select: {
        id: true,
        code: true,
        supplierTaxInvoiceNumber: true,
        statusReceipt: true,
        receivedAt: true,
        printed: true,
        items: {
          select: {
            quantity: true,
            stockItems: { select: { id: true } }, // ใช้แค่นับ ไม่ต้องดึงทั้งหมด
          },
        },
        purchaseOrder: { select: { code: true, supplier: { select: { name: true } } } },
      },
      orderBy: { receivedAt: 'desc' },
    });

    const summaries = receipts.map((receipt) => {
      const total = receipt.items.reduce((sum, item) => sum + item.quantity, 0);
      const generated = receipt.items.reduce((sum, item) => sum + item.stockItems.length, 0);
      
      

      return {
        id: receipt.id,
        code: receipt.code,
        tax: receipt.supplierTaxInvoiceNumber,
        receivedAt: receipt.receivedAt,
        supplierName: receipt.purchaseOrder?.supplier?.name || '-',
        orderCode: receipt.purchaseOrder?.code || '-',
        totalItems: total,
        barcodeGenerated: generated,
        status: receipt.statusReceipt,
        printed: !!receipt.printed,
      };
    });

    res.set('Cache-Control', 'no-store');
    return res.json(summaries);
  } catch (error) {
    console.error('❌ [getReceiptBarcodeSummaries] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลใบรับสินค้าสำหรับพิมพ์บาร์โค้ดได้' });
  }
};

// ---- Auto finalize when all SNs generated ----
const finalizePurchaseOrderReceiptIfNeeded = async (receiptId) => {
  const receipt = await prisma.purchaseOrderReceipt.findUnique({
    where: { id: receiptId },
    select: { id: true, purchaseOrderId: true },
  });
  if (!receipt) return;

  // ใช้สถานะจาก barcodeReceiptItem ทั้ง SN & LOT
  const pending = await getReceiptPendingCounts(prisma, receiptId);
  if ((pending.pendingSN + pending.pendingLOT) > 0) return;

  // ปิดใบ + อัปเดตสถานะ PO ภายใน tx เดียว
  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrderReceipt.update({
      where: { id: receiptId },
      data: { statusReceipt: 'COMPLETED' },
    });
    try {
      const poStatus = await computePoStatus(tx, receipt.purchaseOrderId);
      await tx.purchaseOrder.update({ where: { id: receipt.purchaseOrderId }, data: { status: poStatus } });
    } catch (e) {
      console.warn('[finalizeReceiptIfNeeded] update PO status skipped:', e?.code || e?.message);
    }
  });
};

const finalizeReceiptController = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const branchId = Number(req.user?.branchId);
    if (!id || !branchId) return res.status(400).json({ error: 'Missing id or branch' });

    const receipt = await prisma.purchaseOrderReceipt.findFirst({
      where: { id, branchId },
      select: { id: true, statusReceipt: true, purchaseOrderId: true },
    });
    if (!receipt) return res.status(404).json({ error: 'ไม่พบใบรับสินค้านี้ในสาขา' });

    const pending = await getReceiptPendingCounts(prisma, id);
    if ((pending.pendingSN + pending.pendingLOT) > 0) {
      return res.status(409).json({
        error: 'ยังมีรายการค้าง (SN/LOT) ไม่ครบ',
        pendingSN: pending.pendingSN,
        pendingLOT: pending.pendingLOT,
      });
    }

    // Idempotent
    if (String(receipt.statusReceipt || '').toUpperCase() === 'COMPLETED') {
      const poStatusNow = await computePoStatus(prisma, receipt.purchaseOrderId);
      return res.status(200).json({ success: true, alreadyCompleted: true, poStatus: poStatusNow });
    }

    const result = await prisma.$transaction(async (tx) => {
      const upd = await tx.purchaseOrderReceipt.update({
        where: { id },
        data: { statusReceipt: 'COMPLETED' },
      });
      let poStatus = 'PENDING';
      try {
        poStatus = await computePoStatus(tx, receipt.purchaseOrderId);
        await tx.purchaseOrder.update({ where: { id: receipt.purchaseOrderId }, data: { status: poStatus } });
      } catch (e) {
        console.warn('[finalizeReceipt] purchaseOrder.status not updated:', e?.code || e?.message);
      }
      return { upd, poStatus };
    });

    return res.status(200).json({ success: true, poStatus: result.poStatus });
  } catch (err) {
    console.error('❌ finalizeReceiptController error:', err);
    return res.status(500).json({ success: false, error: 'Failed to finalize receipt.' });
  }
};

// ---- Mark as printed (branch-scoped, no printedAt) ----
const markPurchaseOrderReceiptAsPrinted = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const branchId = Number(req.user?.branchId);

    if (!id || !branchId) {
      return res.status(400).json({ message: 'ต้องระบุ id และต้องมีสิทธิ์สาขา (branchId) จาก token' });
    }

    // อัปเดตแบบ branch-scoped และไม่ใช้ printedAt ตาม schema จริง
    const result = await prisma.purchaseOrderReceipt.updateMany({
      where: { id, branchId },
      data: { printed: true },
    });

    if (result.count === 0) {
      // ไม่พบเอกสารในสาขานี้หรืออัปเดตไม่ได้
      return res.status(404).json({ message: 'ไม่พบใบรับของสำหรับสาขานี้ หรือถูกอัปเดตไปแล้ว' });
    }

    // ดึงข้อมูลยืนยันกลับ (select เฉพาะฟิลด์ที่มีจริง)
    const receipt = await prisma.purchaseOrderReceipt.findFirst({
      where: { id, branchId },
      select: { id: true, code: true, printed: true },
    });

    return res.json({ success: true, receipt });
  } catch (error) {
    console.error('❌ markPurchaseOrderReceiptAsPrinted error:', error);
    return res.status(500).json({ error: 'Failed to mark receipt as printed' });
  }
};

// ---- Receipts ready to pay (Decimal-safe) ----
const getReceiptsReadyToPay = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    const { startDate, endDate, limit } = req.query;
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));

    const receipts = await prisma.purchaseOrderReceipt.findMany({
      where: {
        branchId,
        statusReceipt: 'COMPLETED',
        statusPayment: { not: 'PAID' },
        receivedAt: Object.keys(dateFilter).length ? dateFilter : undefined,
      },
      include: {
        items: { select: { quantity: true, costPrice: true } },
        purchaseOrder: {
          select: {
            id: true,
            code: true,
            supplier: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                creditLimit: true,
                creditBalance: true,
              },
            },
          },
        },
      },
      orderBy: { receivedAt: 'asc' },
      take: limit ? Number(limit) : undefined,
    });

    const results = await Promise.all(
      receipts.map(async (receipt) => {
        const totalAmount = receipt.items.reduce(
          (sum, it) => sum.plus(D(it.costPrice).times(it.quantity)),
          new Prisma.Decimal(0)
        );

        const paidAgg = await prisma.supplierPaymentReceipt.aggregate({
          _sum: { amountPaid: true },
          where: { receiptId: receipt.id },
        });
        const paidAmount = paidAgg._sum.amountPaid || new Prisma.Decimal(0);
        const remainingAmount = totalAmount.minus(paidAmount);

        const supplier = { ...receipt.purchaseOrder.supplier };
        if (NORMALIZE_DECIMAL_TO_NUMBER) {
          for (const k of ['creditLimit', 'creditBalance']) {
            if (supplier[k]?.toNumber) supplier[k] = supplier[k].toNumber();
          }
        }

        const out = {
          id: receipt.id,
          code: receipt.code,
          orderCode: receipt.purchaseOrder.code,
          supplier,
          totalAmount,
          paidAmount,
          remainingAmount,
          receivedDate: receipt.receivedAt,
        };
        if (NORMALIZE_DECIMAL_TO_NUMBER) {
          out.totalAmount = toNum(out.totalAmount);
          out.paidAmount = toNum(out.paidAmount);
          out.remainingAmount = toNum(out.remainingAmount);
        }
        return out;
      })
    );

    const filtered = results.filter((r) =>
      NORMALIZE_DECIMAL_TO_NUMBER ? r.remainingAmount > 0 : r.remainingAmount.greaterThan(0)
    );

    return res.json(filtered);
  } catch (error) {
    console.error('❌ [getReceiptsReadyToPay] error:', error);
    return res.status(500).json({ error: 'Failed to load outstanding receipts.' });
  }
};

// ---- QUICK Receipt (source='QUICK') ----
// payload: { note?, supplierId?, items: [{ productId, quantity, costPrice }], flags?: { autoGenerateBarcodes?, printLot? } }
const createQuickReceipt = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    const receivedById = Number(req.user?.employeeId);
    if (!branchId || !receivedById) return res.status(401).json({ error: 'unauthorized' });

    const { note, supplierId, items = [], flags = {} } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'ต้องระบุ items อย่างน้อย 1 รายการ' });

    // Validate items minimally
    for (const it of items) {
      if (!it?.productId) return res.status(400).json({ error: 'รายการต้องมี productId' });
      if (it?.quantity == null) return res.status(400).json({ error: 'รายการต้องมี quantity' });
      if (it?.costPrice == null) return res.status(400).json({ error: 'รายการต้องมี costPrice' });
    }

    // Tx: create receipt + items with code auto sequence
    const created = await prisma.$transaction(async (tx) => {
      const code = await generateReceiptCode(branchId, tx);
      const receipt = await tx.purchaseOrderReceipt.create({
        data: {
          code,
          note: note || null,
          receivedById,
          branch: { connect: { id: branchId } },
          supplier: supplierId ? { connect: { id: Number(supplierId) } } : undefined,
          source: 'QUICK',
          items: {
            create: items.map((it) => ({
              product: { connect: { id: Number(it.productId) } },
              quantity: new Prisma.Decimal(String(it.quantity)),
              costPrice: new Prisma.Decimal(String(it.costPrice)),
            })),
          },
        },
        include: {
          items: { select: { id: true, productId: true, quantity: true, costPrice: true } },
        },
      });
      return receipt;
    }, { timeout: 20000, maxWait: 8000 });

    return res.status(201).json({ success: true, data: created, flags });
  } catch (error) {
    console.error('❌ [createQuickReceipt] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถสร้าง QUICK receipt ได้' });
  }
};

// ---- Helper: load receipt with product mode per item ----
const loadReceiptWithModes = async (id, branchId) => {
  return prisma.purchaseOrderReceipt.findFirst({
    where: { id, branchId },
    include: {
      items: {
        include: {
          product: { select: { id: true, mode: true } },
          purchaseOrderItem: { select: { product: { select: { id: true, mode: true } } } },
        },
      },
    },
  });
};

// ---- Barcode generation (id param) ----
const generateReceiptBarcodes = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const branchId = Number(req.user?.branchId);
    if (!id || !branchId) return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });

    const receipt = await loadReceiptWithModes(id, branchId);
    if (!receipt) return res.status(404).json({ error: 'ไม่พบเอกสารในสาขานี้' });

    const now = dayjs();
    const yearMonth = now.format('YYMM');

    const result = await prisma.$transaction(async (tx) => {
      // Ensure counter exists per (branchId, yearMonth)
      await tx.barcodeCounter.upsert({
        where: { branchId_yearMonth: { branchId, yearMonth } },
        update: {},
        create: { branchId, yearMonth, lastNumber: 0 },
      });

      const createdBarcodes = [];
      for (const it of receipt.items) {
        const mode = it.product?.mode || it.purchaseOrderItem?.product?.mode || 'STRUCTURED';
        if (mode === 'SIMPLE') {
          // LOT: 1 code per item
          const counter = await tx.barcodeCounter.update({
            where: { branchId_yearMonth: { branchId, yearMonth } },
            data: { lastNumber: { increment: 1 } },
            select: { lastNumber: true },
          });
          const running = String(counter.lastNumber).padStart(6, '0');
          const barcode = `${branchId}${yearMonth}${running}`;
          const b = await tx.barcodeReceiptItem.create({
            data: {
              barcode,
              yearMonth,
              runningNumber: counter.lastNumber,
              status: 'READY',
              kind: 'LOT',
              branchId,
              purchaseOrderReceiptId: receipt.id,
              receiptItemId: it.id,
            },
          });
          createdBarcodes.push(b);
        } else {
          // STRUCTURED: N codes = quantity
          const qty = Number(it.quantity);
          for (let i = 0; i < qty; i++) {
            const counter = await tx.barcodeCounter.update({
              where: { branchId_yearMonth: { branchId, yearMonth } },
              data: { lastNumber: { increment: 1 } },
              select: { lastNumber: true },
            });
            const running = String(counter.lastNumber).padStart(6, '0');
            const barcode = `${branchId}${yearMonth}${running}`;
            const b = await tx.barcodeReceiptItem.create({
              data: {
                barcode,
                yearMonth,
                runningNumber: counter.lastNumber,
                status: 'READY',
                kind: 'SN',
                branchId,
                purchaseOrderReceiptId: receipt.id,
                receiptItemId: it.id,
              },
            });
            createdBarcodes.push(b);
          }
        }
      }
      return createdBarcodes;
    }, { timeout: 20000, maxWait: 8000 });

    return res.json({ success: true, count: result.length });
  } catch (error) {
    console.error('❌ [generateReceiptBarcodes] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถสร้างบาร์โค้ดได้' });
  }
};

// ---- Print (mark printed and return payload) ----
const printReceipt = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const branchId = Number(req.user?.branchId);
    if (!id || !branchId) return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });

    await prisma.purchaseOrderReceipt.updateMany({ where: { id, branchId }, data: { printed: true } });

    // Load printable barcodes
    const barcodes = await prisma.barcodeReceiptItem.findMany({
      where: { purchaseOrderReceiptId: id, branchId },
      select: { barcode: true, kind: true, receiptItemId: true },
      orderBy: { runningNumber: 'asc' },
    });

    return res.json({ success: true, barcodes });
  } catch (error) {
    console.error('❌ [printReceipt] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถพิมพ์บาร์โค้ดได้' });
  }
};

// ---- Commit (auto-generate if missing; SIMPLE→StockBalance, STRUCTURED→StockItem) ----
const commitReceipt = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const branchId = Number(req.user?.branchId);
    if (!id || !branchId) return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });

    // Ensure barcodes exist; if not, generate
    const existing = await prisma.barcodeReceiptItem.count({ where: { purchaseOrderReceiptId: id, branchId } });
    if (existing === 0) {
      await generateReceiptBarcodes({ params: { id }, user: { branchId } }, { status: () => ({ json: () => null }) });
    }

    // Commit stock effects inside tx
    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.purchaseOrderReceipt.findFirst({
        where: { id, branchId },
        include: {
          items: {
            include: {
              product: true,
              purchaseOrderItem: { include: { product: true } },
              barcodeReceiptItem: true,
            },
          },
        },
      });
      if (!receipt) throw new Error('ไม่พบเอกสารในสาขานี้');

      for (const it of receipt.items) {
        const product = it.product || it.purchaseOrderItem?.product;
        if (!product) throw new Error('ไม่พบข้อมูลสินค้าในรายการรับ');
        const mode = product.mode || 'STRUCTURED';

        if (mode === 'SIMPLE') {
          // 1) Create SimpleLot (one per item) and link barcode kind LOT
          const lot = await tx.simpleLot.create({
            data: {
              branchId,
              productId: product.id,
              qtyInitial: it.quantity,
              status: 'ACTIVE',
              receiptItem: { connect: { id: it.id } },
            },
          });

          await tx.stockBalance.upsert({
            where: { productId_branchId: { productId: product.id, branchId } },
            update: { quantity: { increment: it.quantity } },
            create: { productId: product.id, branchId, quantity: it.quantity },
          });

          // Link LOT barcode(s) to this simpleLot
          await tx.barcodeReceiptItem.updateMany({
            where: { receiptItemId: it.id, kind: 'LOT', branchId },
            data: { simpleLotId: lot.id },
          });
        } else {
          // STRUCTURED: create N StockItem and attach SN barcodes
          const qty = Number(it.quantity);
          const snList = await tx.barcodeReceiptItem.findMany({
            where: { receiptItemId: it.id, kind: 'SN', branchId },
            orderBy: { runningNumber: 'asc' },
            select: { id: true, barcode: true },
          });
          if (snList.length < qty) throw new Error('จำนวน SN ไม่พอสำหรับ commit');

          for (let i = 0; i < qty; i++) {
            const sn = snList[i];
            const stockItem = await tx.stockItem.create({
              data: {
                branchId,
                productId: product.id,
                status: 'IN_STOCK',
                serialNumber: sn.barcode,
                purchaseOrderReceiptItemId: it.id,
              },
              select: { id: true },
            });
            await tx.barcodeReceiptItem.update({ where: { id: sn.id }, data: { stockItemId: stockItem.id } });
          }
        }
      }

      // Mark receipt completed & ready to sell
      await tx.purchaseOrderReceipt.update({ where: { id }, data: { statusReceipt: 'COMPLETED' } });
      return { id };
    }, { timeout: 30000, maxWait: 8000 });

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ [commitReceipt] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถ commit ใบรับสินค้าได้' });
  }
};

// ────────────────────────────────────────────────────────────────────────────────
// Summaries for FE list page (to avoid 501 on /summaries)
// ────────────────────────────────────────────────────────────────────────────────
const getReceiptSummaries = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    const receipts = await prisma.purchaseOrderReceipt.findMany({
      where: { branchId },
      select: { id: true, printed: true },
    });
    const total = receipts.length;
    const printed = receipts.filter((r) => !!r.printed).length;
    const notPrinted = total - printed;

    return res.json({ total, printed, notPrinted });
  } catch (e) {
    console.error('❌ [getReceiptSummaries] error:', e);
    return res.status(500).json({ error: 'Failed to load receipt summaries' });
  }
};

// alias to match routes helper
const getAllReceipts = getAllPurchaseOrderReceipts;

module.exports = {
  createPurchaseOrderReceipt,
  // list (aliases for routes)
  getAllPurchaseOrderReceipts,
  getAllReceipts,
  getReceiptSummaries,

  getPurchaseOrderReceiptById,
  getPurchaseOrderDetailById,  
  updatePurchaseOrderReceipt,
  deletePurchaseOrderReceipt,

  // printing / barcodes
  getReceiptBarcodeSummaries,
  finalizePurchaseOrderReceiptIfNeeded,
  finalizeReceiptController,
  markPurchaseOrderReceiptAsPrinted,
  getReceiptsReadyToPay,

  // quick flow
  createQuickReceipt,
  generateReceiptBarcodes,
  printReceipt,
  commitReceipt,
};




