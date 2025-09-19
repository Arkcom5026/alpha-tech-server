
const { prisma, Prisma } = require('../lib/prisma');

// Decimal helper
const D = (v) => new Prisma.Decimal(v);
const isFiniteNum = (v) => Number.isFinite(Number(v));

// Stock movement types
const STOCK_MOVE = { RECEIVE: 'RECEIVE', SALE: 'SALE', ADJUST: 'ADJUST' };


const _ensureBalance = async (tx, { productId, branchId }) => {

  return tx.branchInventory.upsert({
    where: { productId_branchId: { productId, branchId } },
    update: {},
    create: { productId, branchId, quantity: D(0) },
  });
}

const _assertSimpleProduct = async (tx, productId) => {

  const p = await tx.product.findUnique({
    where: { id: productId },
    select: { id: true, mode: true, allowNegative: true, trackSerialNumber: true },
  });
  if (!p) { const e = new Error('PRODUCT_NOT_FOUND'); e.code = 'PRODUCT_NOT_FOUND'; throw e; }
  if (p.mode !== 'SIMPLE' || p.trackSerialNumber === true) { const e = new Error('NOT_SIMPLE_PRODUCT'); e.code = 'NOT_SIMPLE_PRODUCT'; throw e; }
  return p;
}


const applySimpleReceipt = async ({ branchId, productId, qty, unitCost, refType = 'SIMPLE_RECEIPT', refId = null, note = null }) => {

  if (!isFiniteNum(qty) || Number(qty) <= 0) { const err = new Error('QTY_MUST_BE_POSITIVE'); err.code = 'QTY_MUST_BE_POSITIVE'; throw err; }
  if (!isFiniteNum(unitCost) || Number(unitCost) < 0) { const err = new Error('COST_MUST_BE_NON_NEGATIVE'); err.code = 'COST_MUST_BE_NON_NEGATIVE'; throw err; }

  return prisma.$transaction(async (tx) => {
    await _assertSimpleProduct(tx, productId);
    const bal = await _ensureBalance(tx, { productId, branchId });
    const oldQty = new Prisma.Decimal(bal.quantity || 0);
    const oldAvg = bal.avgCost == null ? null : new Prisma.Decimal(bal.avgCost);

    const inQty = D(qty); const inCost = D(unitCost);
    const newQty = oldQty.add(inQty);
    const newAvg = !oldAvg || oldQty.lte(0) ? inCost : oldQty.mul(oldAvg).add(inQty.mul(inCost)).div(newQty);

    await tx.branchInventory.update({
      where: { productId_branchId: { productId, branchId } },
      data: { quantity: newQty, avgCost: newAvg, lastReceivedCost: inCost },
    });

    await tx.stockMovement.create({
      data: { productId, branchId, qty: inQty, type: STOCK_MOVE.RECEIVE, refType, refId, note },
    });

    return { productId, branchId, quantity: newQty.toNumber(), avgCost: newAvg.toNumber() };
  });
}

// ขายแบบ SIMPLE
const applySimpleSale = async ({ saleId, branchId, productId, qty, basePrice, discount = 0, vatRate = 7, note = null }) => {

  if (!isFiniteNum(qty) || Number(qty) <= 0) { const err = new Error('QTY_MUST_BE_POSITIVE'); err.code = 'QTY_MUST_BE_POSITIVE'; throw err; }

  return prisma.$transaction(async (tx) => {
    const prod = await _assertSimpleProduct(tx, productId);
    const bal = await tx.branchInventory.findUnique({ where: { productId_branchId: { productId, branchId } } });
    const currQty = new Prisma.Decimal(bal?.quantity || 0);
    const outQty = D(qty);

    if (!prod.allowNegative && currQty.lt(outQty)) { const err = new Error('INSUFFICIENT_STOCK'); err.code = 'INSUFFICIENT_STOCK'; throw err; }

    const unitPrice = D(basePrice || 0).sub(D(discount || 0));
    const linePrice = unitPrice.mul(outQty);
    const vatAmount = linePrice.mul(D(vatRate || 0)).div(D(100));

    await tx.saleItemSimple.create({
      data: { saleId, productId, quantity: outQty, basePrice: D(basePrice || 0), discount: D(discount || 0), price: linePrice, vatAmount, remark: note || null },
    });

    await tx.stockMovement.create({
      data: { productId, branchId, qty: outQty.negated(), type: STOCK_MOVE.SALE, refType: 'SALE_ITEM_SIMPLE', refId: Number(saleId) || null, note },
    });

    if (bal) {
      await tx.branchInventory.update({ where: { productId_branchId: { productId, branchId } }, data: { quantity: currQty.sub(outQty) } });
    } else {
      await tx.branchInventory.create({ data: { productId, branchId, quantity: outQty.negated() } });
    }

    return { productId, branchId, quantity: (bal ? currQty.sub(outQty) : outQty.negated()).toNumber() };
  });
}

// ปรับยอดแบบ SIMPLE
const applySimpleAdjust = async ({ branchId, productId, qtyDiff, note = null, unitCost = null }) => {

  if (!isFiniteNum(qtyDiff) || Number(qtyDiff) === 0) { const err = new Error('QTY_MUST_BE_POSITIVE'); err.code = 'QTY_MUST_BE_POSITIVE'; throw err; }

  return prisma.$transaction(async (tx) => {
    const prod = await _assertSimpleProduct(tx, productId);
    const bal = await _ensureBalance(tx, { productId, branchId });
    const currQty = new Prisma.Decimal(bal.quantity || 0);
    const delta = D(qtyDiff);

    if (!prod.allowNegative && currQty.add(delta).lt(0)) { const err = new Error('INSUFFICIENT_STOCK'); err.code = 'INSUFFICIENT_STOCK'; throw err; }

    let newAvg = bal.avgCost == null ? null : new Prisma.Decimal(bal.avgCost);
    if (delta.gt(0) && unitCost != null) {
      if (!isFiniteNum(unitCost) || Number(unitCost) < 0) { const err = new Error('COST_MUST_BE_NON_NEGATIVE'); err.code = 'COST_MUST_BE_NON_NEGATIVE'; throw err; }
      newAvg = currQty.lte(0) || !newAvg ? D(unitCost) : currQty.mul(newAvg).add(delta.mul(D(unitCost))).div(currQty.add(delta));
    }

    await tx.branchInventory.update({
      where: { productId_branchId: { productId, branchId } },
      data: { quantity: currQty.add(delta), ...(newAvg ? { avgCost: newAvg } : {}) },
    });

    await tx.stockMovement.create({
      data: { productId, branchId, qty: delta, type: STOCK_MOVE.ADJUST, refType: 'SIMPLE_ADJUST', refId: null, note },
    });

    const newQty = currQty.add(delta);
    return { productId, branchId, quantity: newQty.toNumber(), avgCost: newAvg ? newAvg.toNumber() : (bal.avgCost ? new Prisma.Decimal(bal.avgCost).toNumber() : null) };
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// Controller helpers
// ────────────────────────────────────────────────────────────────────────────────
const toNum = (v) => {
  if (v === '' || v === null || v === undefined) return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const toInt = (v) => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isInteger(n) ? n : undefined;
};

const ensureBranch = (req) => {

  const branchId = req?.user?.branchId;
  if (!branchId) {
    const err = new Error('BRANCH_REQUIRED');
    err.status = 401;
    err.clientMessage = 'กรุณาเข้าสู่ระบบ/เลือกสาขาก่อนทำรายการ';
    throw err;
  }
  return branchId;
}

const mapServiceError = (e, fallbackMsg = 'ไม่สามารถทำรายการได้') => {

  switch (e?.code || e?.message) {
    case 'INSUFFICIENT_STOCK':
      return { status: 409, message: 'สต๊อกไม่เพียงพอ' };
    case 'PRODUCT_NOT_FOUND':
      return { status: 404, message: 'ไม่พบสินค้า' };
    case 'NOT_SIMPLE_PRODUCT':
      return { status: 422, message: 'อนุญาตเฉพาะสินค้าโหมด SIMPLE เท่านั้น' };
    case 'QTY_MUST_BE_POSITIVE':
      return { status: 400, message: 'จำนวนต้องมากกว่า 0' };
    case 'COST_MUST_BE_NON_NEGATIVE':
      return { status: 400, message: 'ต้นทุนต้องไม่ติดลบ' };
    case 'BRANCH_REQUIRED':
      return { status: 401, message: 'กรุณาเข้าสู่ระบบ/เลือกสาขาก่อนทำรายการ' };
    default:
      return { status: e?.status || 500, message: e?.clientMessage || fallbackMsg };
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// Controller handlers (formerly controllers/simpleStockController.js)
// ────────────────────────────────────────────────────────────────────────────────
const createSimpleReceipt = async (req, res) => {

  try {
    const branchId = ensureBranch(req);
    const productId = toInt(req.body?.productId ?? req.body?.id);
    const qty = toNum(req.body?.qty ?? req.body?.quantity);
    const unitCost = toNum(req.body?.unitCost ?? req.body?.costPrice);
    const refType = req.body?.refType;
    const refId = toInt(req.body?.refId);
    const note = (req.body?.note || '').toString().trim() || undefined;

    if (!productId || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
      return res.status(400).json({ message: 'ข้อมูลไม่ถูกต้อง (productId/qty/unitCost)' });
    }

    const result = await applySimpleReceipt({ branchId, productId, qty, unitCost, refType, refId, note });
    return res.status(201).json(result);
  } catch (e) {
    console.error('❌ [createSimpleReceipt] error:', e);
    const { status, message } = mapServiceError(e, 'ไม่สามารถบันทึกรับเข้าได้');
    return res.status(status).json({ message });
  }
}

const createSimpleSale = async (req, res) => {

  try {
    const branchId = ensureBranch(req);
    const saleId = toInt(req.body?.saleId);
    const productId = toInt(req.body?.productId);
    const qty = toNum(req.body?.qty ?? req.body?.quantity);
    const basePrice = toNum(req.body?.basePrice ?? req.body?.price);
    const discount = req.body?.discount != null ? toNum(req.body.discount) : 0;
    const vatRateRaw = req.body?.vatRate;
    const vatRate = Number.isFinite(toNum(vatRateRaw)) ? toNum(vatRateRaw) : 7;
    const note = (req.body?.note || '').toString().trim() || undefined;

    if (!saleId || !productId || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(basePrice)) {
      return res.status(400).json({ message: 'ข้อมูลไม่ถูกต้อง (saleId/productId/qty/basePrice)' });
    }
    if (basePrice < 0) {
      return res.status(400).json({ message: 'ราคาสินค้าต้องไม่ติดลบ' });
    }
    if (!Number.isFinite(discount) || discount < 0 || discount > basePrice) {
      return res.status(400).json({ message: 'ส่วนลดต้องอยู่ระหว่าง 0 ถึงราคาสินค้า' });
    }
    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 20) {
      return res.status(400).json({ message: 'อัตราภาษีมูลค่าเพิ่มไม่ถูกต้อง' });
    }

    const result = await applySimpleSale({ saleId, branchId, productId, qty, basePrice, discount, vatRate, note });
    return res.status(201).json(result);
  } catch (e) {
    console.error('❌ [createSimpleSale] error:', e);
    const { status, message } = mapServiceError(e, 'ไม่สามารถบันทึกการขายได้');
    return res.status(status).json({ message });
  }
}

const createSimpleAdjustment = async (req, res) => {

  try {
    const branchId = ensureBranch(req);
    const productId = toInt(req.body?.productId);
    const qtyDiff = toNum(req.body?.qtyDiff ?? req.body?.qty ?? req.body?.quantityDiff ?? req.body?.quantity);
    const unitCostRaw = req.body?.unitCost ?? req.body?.costPrice;
    const unitCost = unitCostRaw != null ? toNum(unitCostRaw) : undefined;
    const note = (req.body?.note || '').toString().trim() || undefined;

    if (!productId || !Number.isFinite(qtyDiff) || qtyDiff === 0) {
      return res.status(400).json({ message: 'ข้อมูลไม่ถูกต้อง (productId/qtyDiff)' });
    }
    if (qtyDiff > 0 && unitCost != null && (!Number.isFinite(unitCost) || unitCost < 0)) {
      return res.status(400).json({ message: 'ต้นทุน (unitCost) ต้องไม่ติดลบเมื่อปรับเพิ่ม' });
    }

    const result = await applySimpleAdjust({ branchId, productId, qtyDiff, note, unitCost });
    return res.status(201).json(result);
  } catch (e) {
    console.error('❌ [createSimpleAdjustment] error:', e);
    const { status, message } = mapServiceError(e, 'ไม่สามารถปรับยอดสต๊อกได้');
    return res.status(status).json({ message });
  }
}

module.exports = {
  createSimpleReceipt,
  createSimpleSale,
  createSimpleAdjustment,
  applySimpleReceipt,
  applySimpleSale,
  applySimpleAdjust,
  __priv: { _ensureBalance, _assertSimpleProduct, STOCK_MOVE, D }
};



