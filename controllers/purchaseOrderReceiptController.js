// purchaseOrderReceiptController.js — patched to prevent interactive transaction timeout (P2028)
// - Use longer transaction timeout
// - Keep transaction SMALL: move non‑critical upserts out of tx
// - Generate unique receipt code inside tx via the same client
// - Be Decimal‑safe and BRANCH_SCOPE_ENFORCED as before

const dayjs = require('dayjs');
const { ReceiptStatus, Prisma } = require('@prisma/client');
const { prisma } = require('../lib/prisma'); // ✅ singleton

// ---- Helpers (Decimal-safe) ----
const D = (v) => new Prisma.Decimal(typeof v === 'string' ? v : Number(v));
const toNum = (v) => (v && typeof v === 'object' && 'toNumber' in v ? v.toNumber() : Number(v));
const NORMALIZE_DECIMAL_TO_NUMBER = process.env.NORMALIZE_DECIMAL_TO_NUMBER !== '0';

// ---- Code generator (monthly sequence; runs INSIDE a tx) ----
/**
 * Generate next running code like RC-<BR><YYMM>-0001 atomically inside the same client/tx.
 * @param {number} branchId
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} client
 */
const generateReceiptCode = async (branchId, client) => {
  const paddedBranch = String(branchId).padStart(2, '0');
  const now = dayjs();
  const prefix = `RC-${paddedBranch}${now.format('YYMM')}`; // e.g., RC-022508

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
  return `${prefix}-${running}`; // RC-022508-0001
};

// ---- Create Receipt (small tx + retry on code collision) ----
const createPurchaseOrderReceipt = async (req, res) => {
  try {
    const purchaseOrderId = Number(req.body.purchaseOrderId);
    const note = req.body.note || null;
    const supplierTaxInvoiceNumber = req.body.supplierTaxInvoiceNumber || null;
    const supplierTaxInvoiceDate = req.body.supplierTaxInvoiceDate || null;

    const branchId = Number(req.user?.branchId);
    const receivedById = Number(req.user?.employeeId);

    if (!purchaseOrderId || !branchId || !receivedById) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบ (purchaseOrderId/branchId/employeeId)' });
    }

    // Ensure PO exists and belongs to this branch
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

    // Keep the critical receipt creation very short inside tx
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
                receivedById,
                code,
                supplierTaxInvoiceNumber,
                supplierTaxInvoiceDate: taxDate,
                branch: { connect: { id: branchId } },
                purchaseOrder: { connect: { id: purchaseOrderId } },
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
            break; // success
          } catch (err) {
            // Unique code collision → retry a few times
            if (err?.code === 'P2002' && String(err?.meta?.target).includes('code') && attempt < maxRetries - 1) {
              continue;
            }
            throw err;
          }
        }

        if (!created) throw new Error('สร้างรหัสใบรับสินค้าแบบไม่ซ้ำไม่สำเร็จ');
      },
      { timeout: 20000, maxWait: 8000 } // ⏱️ extend interactive tx time budget
    );

    // 💡 Non-critical work OUTSIDE the tx to avoid timeouts
    // Upsert branch prices for each item in PO (keep costPrice up-to-date)
    // Fire-and-wait (still awaited), but not inside the transaction
    for (const it of po.items) {
      try {
        await prisma.branchPrice.upsert({
          where: { productId_branchId: { productId: it.productId, branchId } },
          update: { costPrice: it.costPrice },
          create: { productId: it.productId, branchId, costPrice: it.costPrice },
        });
      } catch (e) {
        // Log and proceed; not critical to block receipt creation
        console.warn('[createPurchaseOrderReceipt] upsert branchPrice warning:', e?.message || e);
      }
    }

    return res.status(201).json(created);
  } catch (error) {
    console.error('❌ [createPurchaseOrderReceipt] error:', error);
    return res.status(500).json({ error: 'สร้างใบรับสินค้าไม่สำเร็จ' });
  }
};

// ---- List Receipts ----
const getAllPurchaseOrderReceipts = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    const receipts = await prisma.purchaseOrderReceipt.findMany({
      where: { branchId },
      include: {
        purchaseOrder: { select: { code: true, supplier: { select: { name: true } } } },
      },
      orderBy: { receivedAt: 'desc' },
    });

    return res.json(receipts);
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

// ---- Mark single receipt as completed ----
const markReceiptAsCompleted = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const branchId = Number(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    const found = await prisma.purchaseOrderReceipt.findFirst({ where: { id, branchId } });
    if (!found) return res.status(404).json({ error: 'ไม่พบใบรับสินค้านี้' });

    const updated = await prisma.purchaseOrderReceipt.update({
      where: { id },
      data: { statusReceipt: 'COMPLETED' },
    });

    return res.json(updated);
  } catch (error) {
    console.error('❌ [markReceiptAsCompleted] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถอัปเดตสถานะใบรับสินค้าได้' });
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

    const receipts = await prisma.purchaseOrderReceipt.findMany({
      where: { branchId },
      select: {
        id: true,
        code: true,
        supplierTaxInvoiceNumber: true,
        statusReceipt: true,
        receivedAt: true,
        items: {
          include: {
            stockItems: true,
            purchaseOrderItem: { select: { product: { select: { name: true } } } },
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
    include: { items: { include: { stockItems: true, purchaseOrderItem: true } } },
  });
  if (!receipt) return;

  const totalQuantity = receipt.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalSN = receipt.items.reduce((sum, item) => sum + item.stockItems.length, 0);
  if (totalSN < totalQuantity) return;

  await prisma.purchaseOrderReceipt.update({
    where: { id: receiptId },
    data: { statusReceipt: 'COMPLETED' }, // ✅ use statusReceipt
  });
};

const finalizeReceiptController = async (req, res) => {
  try {
    const id = Number(req.params.id);
    await finalizePurchaseOrderReceiptIfNeeded(id);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ finalizeReceiptController error:', err);
    return res.status(500).json({ success: false, error: 'Failed to finalize receipt.' });
  }
};

// ---- Mark as printed (completed) ----
const markPurchaseOrderReceiptAsPrinted = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = await prisma.purchaseOrderReceipt.update({
      where: { id },
      data: { statusReceipt: ReceiptStatus.COMPLETED },
    });
    return res.json({ success: true, receipt: updated });
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

module.exports = {
  createPurchaseOrderReceipt,
  getAllPurchaseOrderReceipts,
  getPurchaseOrderReceiptById,
  getPurchaseOrderDetailById,
  markReceiptAsCompleted,
  updatePurchaseOrderReceipt,
  deletePurchaseOrderReceipt,
  getReceiptBarcodeSummaries,
  finalizePurchaseOrderReceiptIfNeeded,
  finalizeReceiptController,
  markPurchaseOrderReceiptAsPrinted,
  getReceiptsReadyToPay,
};
