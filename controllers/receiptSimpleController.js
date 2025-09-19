
const { prisma } = require('../lib/prisma');
const bcrypt = require('bcryptjs');

// ------------------------------
// Helpers: math / summary / policy
// ------------------------------
const computeSummary = (items, vatRateHeader = 7) => {
  const vatHeader = Number.isFinite(Number(vatRateHeader)) ? Number(vatRateHeader) : 7;
  let subtotal = 0;
  let vatTotal = 0;
  const lines = (items || []).map((it) => {
    const qty = Math.trunc(Number(it.qty || it.quantity || 0));
    const unitCost = Number(it.unitCost ?? it.costPrice ?? 0);
    const lineVatRate = it.vatRate != null ? Number(it.vatRate) : vatHeader;
    const lineSubtotal = qty * unitCost;
    const lineVat = lineSubtotal * (lineVatRate / 100);
    const lineTotal = lineSubtotal + lineVat;
    subtotal += lineSubtotal;
    vatTotal += lineVat;
    return { ...it, qty, unitCost, vatRate: lineVatRate, lineSubtotal, lineVat, lineTotal };
  });
  const total = subtotal + vatTotal;
  return { lines, subtotal, vatTotal, total, vatRate: vatHeader };
};

const readQuickReceiveLimits = async (branchId) => {
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, features: true } });
  const features = branch && typeof branch.features === 'object' ? branch.features : {};
  const quickCfg = features && typeof features.quickReceive === 'object' ? features.quickReceive : {};
  const maxLinesPerDay = Number(quickCfg.maxLinesPerDay);
  const maxAmountPerDay = Number(quickCfg.maxAmountPerDay);
  return {
    maxLinesPerDay: Number.isFinite(maxLinesPerDay) && maxLinesPerDay > 0 ? maxLinesPerDay : null,
    maxAmountPerDay: Number.isFinite(maxAmountPerDay) && maxAmountPerDay > 0 ? maxAmountPerDay : null,
  };
};

const enforceDocumentLimits = ({ items, vatRate, limits }) => {
  const { maxLinesPerDay, maxAmountPerDay } = limits || {};
  const linesCount = Array.isArray(items) ? items.length : 0;
  const { subtotal, vatTotal } = computeSummary(items, vatRate);
  const totalWithVat = subtotal + vatTotal;
  if (maxLinesPerDay && linesCount > maxLinesPerDay) {
    const err = new Error('เกินจำนวนบรรทัดที่อนุญาตต่อเอกสาร/วัน');
    err.code = 'LIMIT_EXCEEDED';
    throw err;
  }
  if (maxAmountPerDay && totalWithVat > maxAmountPerDay) {
    const err = new Error('เกินมูลค่าที่อนุญาตต่อเอกสาร/วัน');
    err.code = 'LIMIT_EXCEEDED';
    throw err;
  }
};

// ------------------------------
// Validators / Normalizers
// ------------------------------
const parseVatRate = (raw) => {
  let vatRate = Number(raw);
  if (!Number.isFinite(vatRate)) vatRate = 7; // TH default
  if (vatRate < 0 || vatRate > 20) {
    const err = new Error('vatRate ต้องอยู่ระหว่าง 0–20');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  return vatRate;
};

const validateAndNormalize = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('ต้องมีรายการสินค้าอย่างน้อย 1 รายการ');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  const out = [];
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx] || {};

    const pidRaw = it.productId ?? it.id;
    const productId = Number(pidRaw);
    if (!Number.isFinite(productId) || productId <= 0) {
      const err = new Error(`แถว ${idx + 1}: productId ไม่ถูกต้อง`);
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const qtyRaw = it.qty ?? it.quantity;
    const qtyNum = Number(qtyRaw);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0 || !Number.isInteger(qtyNum)) {
      const err = new Error(`แถว ${idx + 1}: qty ต้องเป็นจำนวนเต็มมากกว่า 0`);
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const unitCostRaw = it.unitCost ?? it.costPrice ?? 0;
    const costNum = Number(unitCostRaw);
    if (!Number.isFinite(costNum) || costNum < 0) {
      const err = new Error(`แถว ${idx + 1}: unitCost ต้องเป็นตัวเลขและไม่ติดลบ`);
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const itemVat = it.vatRate != null ? Number(it.vatRate) : undefined;
    out.push({ productId, qty: Math.trunc(qtyNum), unitCost: costNum, vatRate: itemVat });
  }
  return out;
};

// ------------------------------
// Code helpers (sequential like purchaseOrderController)
// ------------------------------
const generatePOCode = async (branchId) => {
  const paddedBranch = String(branchId).padStart(2, '0');
  const now = new Date();
  const yymm = `${now.getFullYear().toString().slice(2)}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const prefix = `PO-${paddedBranch}${yymm}-`;
  const latest = await prisma.purchaseOrder.findFirst({ where: { code: { startsWith: prefix } }, orderBy: { code: 'desc' } });
  let next = 1;
  if (latest) {
    const lastSeq = parseInt(latest.code.slice(-4), 10);
    next = (isNaN(lastSeq) ? 0 : lastSeq) + 1;
  }
  return `${prefix}${String(next).padStart(4, '0')}`;
};

const generatePORCode = async (branchId) => {
  const paddedBranch = String(branchId).padStart(2, '0');
  const now = new Date();
  const yymm = `${now.getFullYear().toString().slice(2)}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const prefix = `POR-${paddedBranch}${yymm}-`;
  const latest = await prisma.purchaseOrderReceipt.findFirst({ where: { code: { startsWith: prefix } }, orderBy: { code: 'desc' } });
  let next = 1;
  if (latest) {
    const lastSeq = parseInt(latest.code.slice(-4), 10);
    next = (isNaN(lastSeq) ? 0 : lastSeq) + 1;
  }
  return `${prefix}${String(next).padStart(4, '0')}`;
};

// ------------------------------
// Guards (policy & Manager PIN)
// ------------------------------
const guardReceiptSimple = async (req, res) => {
  const user = req.user || {};
  const branchId = user.branchId;
  if (!branchId) {
    res.status(401).json({ message: 'ไม่พบ branchId ในสิทธิ์ผู้ใช้' });
    return false;
  }
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, features: true } });
  const features = branch && typeof branch.features === 'object' ? branch.features : {};
  const cfg = features && typeof features.quickReceive === 'object' ? features.quickReceive : {};
  const enabled = cfg.enabled !== false; // default = true
  if (!enabled) {
    res.status(403).json({ code: 'RECEIPT_SIMPLE_DISABLED', message: 'สาขานี้ปิดการรับสินค้าแบบ Simple' });
    return false;
  }
  const { managerPin } = req.body || {};
  if (managerPin) {
    const profile = await prisma.employeeProfile.findFirst({ where: { userId: user.id, branchId }, select: { managerPinHash: true } });
    const hash = profile && profile.managerPinHash;
    if (!hash) { res.status(401).json({ code: 'PIN_INVALID', message: 'ไม่มีสิทธิ์หรือยังไม่ได้ตั้งค่า Manager PIN' }); return false; }
    const ok = await bcrypt.compare(String(managerPin), hash);
    if (!ok) { res.status(401).json({ code: 'PIN_INVALID', message: 'Manager PIN ไม่ถูกต้อง' }); return false; }
    req.receiptSimple = { ...(req.receiptSimple || {}), pinApproved: true };
  }
  return true;
};

// ------------------------------
// Optional helpers (side ledgers)
// ------------------------------
const todayRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
};

const recordInventoryTransactions = async (tx, { branchId, userId, receiptId, items }) => {
  const ids = [];
  for (const it of items) {
    try {
      const txn = await tx.inventoryTransaction.create({
        data: {
          branchId,
          productId: it.productId,
          qty: Number(it.qty),
          unitCost: Number(it.unitCost || 0),
          type: 'RECEIPT_PO',
          refType: 'PO_RECEIPT',
          refId: receiptId,
          note: 'Receipt Simple',
          createdBy: userId,
        },
      });
      ids.push(txn.id);
    } catch (err) {
      err.code = err.code || 'VALIDATION_ERROR';
      err.message = err.message || 'บันทึกธุรกรรมสต๊อกไม่สำเร็จ';
      throw err;
    }
  }
  return ids;
};

const recordPaymentIfAny = async (tx, { branchId, userId, supplierId, receiptId, payment }) => {
  if (!payment || !payment.method) return null;
  try {
    const amount = Number(payment.paidAmount || 0);
    const pay = await tx.payment.create({
      data: {
        branchId,
        supplierId,
        amount,
        method: String(payment.method), // 'CASH' | 'TRANSFER' | 'CREDIT'
        note: payment.note || 'Receipt Simple',
        refType: 'PO_RECEIPT',
        refId: receiptId,
        createdBy: userId,
      },
    });
    return pay.id;
  } catch (err) {
    err.code = err.code || 'VALIDATION_ERROR';
    err.message = err.message || 'บันทึกการชำระเงินไม่สำเร็จ';
    throw err;
  }
};

// ------------------------------
// POST /api/receipts/simple (persist)
// ------------------------------
const create = async (req, res) => {
  try {
    const user = req.user || {};
    const branchId = user.branchId;
    const userId = user.id;

    if (!branchId || !userId) {
      return res.status(401).json({ message: 'ไม่พบสิทธิ์การใช้งานสาขา (branchId) หรือผู้ใช้ (userId)' });
    }

    const passed = await guardReceiptSimple(req, res);
    if (!passed) return;

    const { items, supplierId, payment, note, managerPin, vatRate: rawVatRate } = req.body || {};

    const vatRate = parseVatRate(rawVatRate);
    const itemsSafe = validateAndNormalize(items);

    const supplierIdNum = Number(supplierId);
    if (!Number.isFinite(supplierIdNum) || supplierIdNum <= 0) {
      return res.status(400).json({ message: 'ต้องเลือกผู้จำหน่าย (supplierId)' });
    }

    const limits = await readQuickReceiveLimits(branchId);
    enforceDocumentLimits({ items: itemsSafe, vatRate, limits });

    const summary = computeSummary(itemsSafe, vatRate);

    let result = null;
    for (let attempt = 0; attempt < 5 && !result; attempt++) {
      const poCode = await generatePOCode(branchId);
      const porCode = await generatePORCode(branchId);
      try {
        result = await prisma.$transaction(async (tx) => {
          const employee = await tx.employeeProfile.findFirst({ where: { userId, branchId }, select: { id: true } });
          if (!employee) { const err = new Error('ไม่พบข้อมูลพนักงานของผู้ใช้งานในสาขานี้'); err.code = 'VALIDATION_ERROR'; throw err; }

          // 1) PurchaseOrder (PO stub for reference)
          const po = await tx.purchaseOrder.create({
            data: { code: poCode, branchId, supplierId: supplierIdNum, employeeId: employee.id, status: 'RECEIVED', note: note ?? '' },
          });

          // 2) PurchaseOrderItem(s)
          const poItems = [];
          for (const it of itemsSafe) {
            const poi = await tx.purchaseOrderItem.create({ data: { purchaseOrderId: po.id, productId: it.productId, quantity: it.qty, costPrice: it.unitCost } });
            poItems.push(poi);
          }

          // 3) PurchaseOrderReceipt (POR header)
          const receipt = await tx.purchaseOrderReceipt.create({
            data: { code: porCode, branchId, purchaseOrderId: po.id, receivedById: employee.id, vatRate, totalAmount: summary.total, note: note ?? '' },
          });

          // 4) Receipt items + update PO receivedQuantity
          const receiptItems = [];
          for (let i = 0; i < itemsSafe.length; i++) {
            const it = itemsSafe[i];
            const poi = poItems[i];
            const pri = await tx.purchaseOrderReceiptItem.create({ data: { receiptId: receipt.id, purchaseOrderItemId: poi.id, quantity: it.qty, costPrice: it.unitCost } });
            receiptItems.push(pri);
            await tx.purchaseOrderItem.update({ where: { id: poi.id }, data: { receivedQuantity: { increment: it.qty } } });
          }

          // 5) Stock: BranchInventory + StockMovement
          for (const it of itemsSafe) {
            await tx.branchInventory.upsert({
              where: { productId_branchId: { productId: it.productId, branchId } },
              update: { quantity: { increment: it.qty }, lastReceivedCost: it.unitCost },
              create: { productId: it.productId, branchId, quantity: it.qty, avgCost: it.unitCost, lastReceivedCost: it.unitCost },
            });
            await tx.stockMovement.create({ data: { branchId, productId: it.productId, qty: it.qty, type: 'RECEIVE', refType: 'PURCHASE_ORDER_RECEIPT', refId: receipt.id } });
          }

          // 6) Optionals: ledgers
          let inventoryTxnIds = [];
          try { inventoryTxnIds = await recordInventoryTransactions(tx, { branchId, userId, receiptId: receipt.id, items: itemsSafe }); } catch (_) {}
          let paymentId = null;
          try { paymentId = await recordPaymentIfAny(tx, { branchId, userId, supplierId: supplierIdNum, receiptId: receipt.id, payment }); } catch (_) {}

          return { po, poItems, receipt, receiptItems, inventoryTxnIds, paymentId };
        });
      } catch (err) {
        if (err?.code === 'P2002' && err?.meta?.target?.includes('code')) { continue; }
        throw err;
      }
    }

    if (!result) { const err = new Error('ไม่สามารถสร้างรหัสเอกสารที่ไม่ซ้ำได้'); err.code = 'DOC_CODE_ERROR'; throw err; }

    return res.status(201).json({
      ok: true,
      persisted: true,
      branchId,
      supplierId: Number(supplierId),
      note: note ?? '',
      vatRate,
      limits,
      summary,
      ids: { purchaseOrderId: result.po.id, receiptId: result.receipt.id, paymentId: result.paymentId || null },
    });
  } catch (err) {
    const code = err && err.code;
    if (code === 'RECEIPT_SIMPLE_DISABLED') return res.status(403).json({ message: 'สาขานี้ปิดการรับสินค้าแบบ Simple' });
    if (code === 'LIMIT_EXCEEDED') return res.status(403).json({ message: 'เกินเพดานรายวัน ต้องใช้ Manager PIN' });
    if (code === 'PIN_INVALID') return res.status(401).json({ message: 'Manager PIN ไม่ถูกต้อง' });
    if (code === 'IDEMPOTENT_REPLAY') return res.status(200).json(err.payload || { message: 'Idempotent replay' });
    if (code === 'VALIDATION_ERROR') return res.status(400).json({ message: err.message || 'ข้อมูลไม่ถูกต้อง' });
    console.error('[receiptSimpleController.create] Unhandled error:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
};

// ------------------------------
// POST /api/receipts/simple/preview (calculate only)
// ------------------------------
const preview = async (req, res) => {
  try {
    const user = req.user || {};
    const branchId = user.branchId;
    const userId = user.id;
    if (!branchId || !userId) { return res.status(401).json({ message: 'ไม่พบสิทธิ์การใช้งานสาขา (branchId) หรือผู้ใช้ (userId)' }); }

    const { items, supplierId, note, managerPin, vatRate: rawVatRate } = req.body || {};

    const passed = await guardReceiptSimple(req, res);
    if (!passed) return;

    const vatRate = parseVatRate(rawVatRate);
    const itemsSafe = validateAndNormalize(items);

    const limits = await readQuickReceiveLimits(branchId);
    enforceDocumentLimits({ items: itemsSafe, vatRate, limits });

    const summary = computeSummary(itemsSafe, vatRate);

    return res.status(200).json({ ok: true, branchId, supplierId: supplierId ?? null, note: note ?? '', vatRate, limits, summary, items: summary.lines });
  } catch (err) {
    const code = err && err.code;
    if (code === 'RECEIPT_SIMPLE_DISABLED') return res.status(403).json({ message: 'สาขานี้ปิดการรับสินค้าแบบ Simple' });
    if (code === 'LIMIT_EXCEEDED') return res.status(403).json({ message: 'เกินเพดานรายวัน ต้องใช้ Manager PIN' });
    if (code === 'PIN_INVALID') return res.status(401).json({ message: 'Manager PIN ไม่ถูกต้อง' });
    if (code === 'VALIDATION_ERROR') return res.status(400).json({ message: err.message || 'ข้อมูลไม่ถูกต้อง' });
    console.error('[receiptSimpleController.preview] Unhandled error:', err);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
};

module.exports = { create, preview };
