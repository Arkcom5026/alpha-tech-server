const {
  PAYMENT_METHOD_VALUES,
  PAYMENT_METHOD_ALIASES,
  SALE_PAYMENT_STATUS_MAP,
} = require('./customerReceiptConstants');

const normalizePaymentMethod = (value) => {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return null;

  const normalized = PAYMENT_METHOD_ALIASES[raw] || raw;
  return PAYMENT_METHOD_VALUES.has(normalized) ? normalized : null;
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isInteger(n) ? n : undefined;
};

const roundMoney = (value) => {
  const n = toNumber(value, 0);
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

const isPositiveMoney = (value) => roundMoney(value) > 0;

const asNullableString = (value) => {
  if (value == null) return null;
  const str = String(value).trim();
  return str || null;
};

const asDateOrNull = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const deriveSalePaymentStatus = ({ totalAmount, paidAmount }) => {
  const total = roundMoney(totalAmount);
  const paid = roundMoney(paidAmount);

  if (paid <= 0) return SALE_PAYMENT_STATUS_MAP.UNPAID;
  if (paid >= total && total > 0) return SALE_PAYMENT_STATUS_MAP.PAID;
  return SALE_PAYMENT_STATUS_MAP.PARTIALLY_PAID;
};

const computeRemainingAmount = ({ totalAmount, allocatedAmount }) =>
  roundMoney(roundMoney(totalAmount) - roundMoney(allocatedAmount));

const getSaleOutstandingAmount = (sale) => {
  const totalAmount = roundMoney(sale?.totalAmount || 0);
  const paidAmount = roundMoney(sale?.paidAmount || 0);
  return roundMoney(totalAmount - paidAmount);
};

module.exports = {
  normalizePaymentMethod,
  toNumber,
  toInt,
  roundMoney,
  isPositiveMoney,
  asNullableString,
  asDateOrNull,
  deriveSalePaymentStatus,
  computeRemainingAmount,
  getSaleOutstandingAmount,
};
