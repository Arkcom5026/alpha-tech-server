const bcrypt = require('bcryptjs');
const repository = require('./receiptSimpleRuntimeRepository');

const createError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const computeSummary = (items, vatRateHeader = 7) => {
  const vatRate = Number.isFinite(Number(vatRateHeader)) ? Number(vatRateHeader) : 7;
  let subtotal = 0;
  let vatTotal = 0;
  const lines = (items || []).map((item) => {
    const qty = Math.trunc(Number(item.qty || item.quantity || 0));
    const unitCost = Number(item.unitCost ?? item.costPrice ?? 0);
    const lineVatRate = item.vatRate != null ? Number(item.vatRate) : vatRate;
    const lineSubtotal = qty * unitCost;
    const lineVat = lineSubtotal * (lineVatRate / 100);
    const lineTotal = lineSubtotal + lineVat;
    subtotal += lineSubtotal;
    vatTotal += lineVat;
    return { ...item, qty, unitCost, vatRate: lineVatRate, lineSubtotal, lineVat, lineTotal };
  });
  return { lines, subtotal, vatTotal, total: subtotal + vatTotal, vatRate };
};

const parseVatRate = (raw) => {
  let vatRate = Number(raw);
  if (!Number.isFinite(vatRate)) vatRate = 7;
  if (vatRate < 0 || vatRate > 20) {
    throw createError('VALIDATION_ERROR', 'vatRate ต้องอยู่ระหว่าง 0–20');
  }
  return vatRate;
};

const normalizeItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw createError('VALIDATION_ERROR', 'ต้องมีรายการสินค้าอย่างน้อย 1 รายการ');
  }
  return items.map((item = {}, index) => {
    const productId = Number(item.productId ?? item.id);
    const qty = Number(item.qty ?? item.quantity);
    const unitCost = Number(item.unitCost ?? item.costPrice ?? 0);
    if (!Number.isFinite(productId) || productId <= 0) {
      throw createError('VALIDATION_ERROR', `แถว ${index + 1}: productId ไม่ถูกต้อง`);
    }
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
      throw createError('VALIDATION_ERROR', `แถว ${index + 1}: qty ต้องเป็นจำนวนเต็มมากกว่า 0`);
    }
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      throw createError('VALIDATION_ERROR', `แถว ${index + 1}: unitCost ต้องเป็นตัวเลขและไม่ติดลบ`);
    }
    return {
      productId,
      qty: Math.trunc(qty),
      unitCost,
      vatRate: item.vatRate != null ? Number(item.vatRate) : undefined,
    };
  });
};

const readPolicy = async (branchId) => {
  const branch = await repository.findBranchFeatures(branchId);
  const features = branch && typeof branch.features === 'object' ? branch.features : {};
  const config = features && typeof features.quickReceive === 'object' ? features.quickReceive : {};
  const maxLinesPerDay = Number(config.maxLinesPerDay);
  const maxAmountPerDay = Number(config.maxAmountPerDay);
  return {
    enabled: config.enabled !== false,
    limits: {
      maxLinesPerDay: Number.isFinite(maxLinesPerDay) && maxLinesPerDay > 0 ? maxLinesPerDay : null,
      maxAmountPerDay: Number.isFinite(maxAmountPerDay) && maxAmountPerDay > 0 ? maxAmountPerDay : null,
    },
  };
};

const assertPolicy = async ({ branchId, userId, managerPin }) => {
  const policy = await readPolicy(branchId);
  if (!policy.enabled) {
    throw createError('RECEIPT_SIMPLE_DISABLED', 'สาขานี้ปิดการรับสินค้าแบบ Simple');
  }
  if (managerPin) {
    const profile = await repository.findManagerPinHash(userId, branchId);
    if (!profile?.managerPinHash || !(await bcrypt.compare(String(managerPin), profile.managerPinHash))) {
      throw createError('PIN_INVALID', 'Manager PIN ไม่ถูกต้อง');
    }
  }
  return policy.limits;
};

const assertLimits = ({ items, vatRate, limits }) => {
  const summary = computeSummary(items, vatRate);
  if (limits.maxLinesPerDay && items.length > limits.maxLinesPerDay) {
    throw createError('LIMIT_EXCEEDED', 'เกินจำนวนบรรทัดที่อนุญาตต่อเอกสาร/วัน');
  }
  if (limits.maxAmountPerDay && summary.total > limits.maxAmountPerDay) {
    throw createError('LIMIT_EXCEEDED', 'เกินมูลค่าที่อนุญาตต่อเอกสาร/วัน');
  }
  return summary;
};

const buildDocumentCode = async (branchId, type) => {
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `${type}-${String(branchId).padStart(2, '0')}${yymm}-`;
  const latest = type === 'PO'
    ? await repository.findLatestPurchaseOrderCode(prefix)
    : await repository.findLatestReceiptCode(prefix);
  const lastSequence = latest ? Number.parseInt(latest.code.slice(-4), 10) : 0;
  return `${prefix}${String((Number.isNaN(lastSequence) ? 0 : lastSequence) + 1).padStart(4, '0')}`;
};

const preview = async ({ branchId, userId, body = {} }) => {
  const limits = await assertPolicy({ branchId, userId, managerPin: body.managerPin });
  const vatRate = parseVatRate(body.vatRate);
  const items = normalizeItems(body.items);
  const summary = assertLimits({ items, vatRate, limits });
  return {
    ok: true,
    branchId,
    supplierId: body.supplierId ?? null,
    note: body.note ?? '',
    vatRate,
    limits,
    summary,
    items: summary.lines,
  };
};

const create = async ({ branchId, userId, body = {} }) => {
  const limits = await assertPolicy({ branchId, userId, managerPin: body.managerPin });
  const vatRate = parseVatRate(body.vatRate);
  const items = normalizeItems(body.items);
  const supplierId = Number(body.supplierId);
  if (!Number.isFinite(supplierId) || supplierId <= 0) {
    throw createError('VALIDATION_ERROR', 'ต้องเลือกผู้จำหน่าย (supplierId)');
  }
  const summary = assertLimits({ items, vatRate, limits });

  let result = null;
  for (let attempt = 0; attempt < 5 && !result; attempt += 1) {
    const poCode = await buildDocumentCode(branchId, 'PO');
    const receiptCode = await buildDocumentCode(branchId, 'POR');
    try {
      result = await repository.createReceiptTransaction({
        branchId,
        userId,
        supplierId,
        payment: body.payment,
        note: body.note,
        vatRate,
        summary,
        items,
        poCode,
        receiptCode,
      });
    } catch (error) {
      if (error?.code === 'P2002' && error?.meta?.target?.includes('code')) continue;
      throw error;
    }
  }
  if (!result) throw createError('DOC_CODE_ERROR', 'ไม่สามารถสร้างรหัสเอกสารที่ไม่ซ้ำได้');

  return {
    ok: true,
    persisted: true,
    branchId,
    supplierId,
    note: body.note ?? '',
    vatRate,
    limits,
    summary,
    ids: {
      purchaseOrderId: result.purchaseOrder.id,
      receiptId: result.receipt.id,
      paymentId: result.paymentId || null,
    },
  };
};

module.exports = { preview, create };
