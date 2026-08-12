'use strict';

const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const positiveInt = (value, code, field) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail(code, `${field} must be a positive integer`);
  return parsed;
};

const parseEligibleSalesQuery = (query = {}, user = {}) => ({
  branchId: positiveInt(user.branchId, 'BRANCH_CONTEXT_REQUIRED', 'branchId'),
  customerId: positiveInt(query.customerId, 'CUSTOMER_REQUIRED', 'customerId'),
  search: String(query.search || '').trim().slice(0, 120),
  take: Math.min(Math.max(Number(query.take) || 100, 1), 200),
});

const normalizeIdempotencyKey = (value) => {
  const commandKey = String(value || '').trim();
  if (!commandKey) return null;
  if (commandKey.length > 100) {
    fail('IDEMPOTENCY_KEY_TOO_LONG', 'X-Idempotency-Key ยาวเกิน 100 ตัวอักษร');
  }
  if (!/^[A-Za-z0-9._:-]+$/.test(commandKey)) {
    fail('INVALID_IDEMPOTENCY_KEY', 'X-Idempotency-Key มีรูปแบบไม่ถูกต้อง');
  }
  return commandKey;
};

const parseCreateSettlementInput = (input = {}, user = {}, idempotencyKey = null) => {
  const branchId = positiveInt(user.branchId, 'BRANCH_CONTEXT_REQUIRED', 'branchId');
  const customerId = positiveInt(input.customerId, 'CUSTOMER_REQUIRED', 'customerId');
  const createdById = positiveInt(user.employeeId, 'EMPLOYEE_CONTEXT_REQUIRED', 'employeeId');
  const lines = Array.isArray(input.lines) ? input.lines : [];
  if (!lines.length) fail('SETTLEMENT_LINES_REQUIRED', 'กรุณาเลือกรายการที่จะตัดยอด');

  const seenLineKeys = new Set();
  const normalizedLines = lines.map((line, index) => {
    const saleId = positiveInt(line.saleId, 'SALE_ID_REQUIRED', `lines[${index}].saleId`);
    const saleItemId = positiveInt(line.saleItemId, 'SALE_ITEM_ID_REQUIRED', `lines[${index}].saleItemId`);
    const lineType = String(line.lineType || '').toUpperCase();
    if (!['STOCK', 'SIMPLE'].includes(lineType)) fail('INVALID_LINE_TYPE', 'ประเภทสินค้าไม่ถูกต้อง');
    const amount = Number(line.amount);
    if (!Number.isFinite(amount) || amount <= 0) fail('INVALID_SETTLEMENT_AMOUNT', 'ยอดตัดชำระต้องมากกว่า 0');

    const lineKey = `${saleId}:${lineType}:${saleItemId}`;
    if (seenLineKeys.has(lineKey)) {
      fail('DUPLICATE_SETTLEMENT_LINE', 'พบรายการสินค้าเดิมซ้ำในคำสั่งตัดยอด');
    }
    seenLineKeys.add(lineKey);

    return { saleId, saleItemId, lineType, amount: Number(amount.toFixed(2)) };
  });

  return {
    branchId,
    customerId,
    createdById,
    commandKey: normalizeIdempotencyKey(idempotencyKey),
    note: String(input.note || '').trim().slice(0, 500) || null,
    lines: normalizedLines,
  };
};

module.exports = {
  fail,
  normalizeIdempotencyKey,
  parseEligibleSalesQuery,
  parseCreateSettlementInput,
};