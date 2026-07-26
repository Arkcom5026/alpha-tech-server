const NORMALIZE_DECIMAL_TO_NUMBER = process.env.NORMALIZE_DECIMAL_TO_NUMBER !== '0';

const toNum = (value) =>
  value && typeof value === 'object' && 'toNumber' in value
    ? value.toNumber()
    : Number(value);

const round2 = (value) => Number(Number(value || 0).toFixed(2));

const toLocalRange = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const resolveCanonicalTotalAmount = (sale) =>
  round2(sale?.totalAmount != null ? toNum(sale.totalAmount) : 0);

const normalizePayment = (payment) => {
  if (!NORMALIZE_DECIMAL_TO_NUMBER || !payment) return payment;
  const normalized = { ...payment };
  if (Array.isArray(normalized.items)) {
    normalized.items = normalized.items.map((item) => ({
      ...item,
      amount: item?.amount != null ? toNum(item.amount) : item.amount,
    }));
  }
  return normalized;
};

const normalizeLineMoney = (item) => {
  const normalized = { ...item };
  for (const key of ['quantity', 'basePrice', 'vatAmount', 'price', 'discount', 'unitCost', 'refundedAmount']) {
    if (key in normalized && normalized[key] != null) normalized[key] = toNum(normalized[key]);
  }
  return normalized;
};

const projectSaleLines = (sale) => {
  const stockItems = Array.isArray(sale?.items)
    ? sale.items.map((item) => ({
        ...normalizeLineMoney(item),
        lineType: 'STOCK_ITEM',
      }))
    : [];

  const simpleItems = Array.isArray(sale?.simpleItems)
    ? sale.simpleItems.map((item) => ({
        ...normalizeLineMoney(item),
        lineType: 'SIMPLE',
      }))
    : [];

  return [...stockItems, ...simpleItems];
};

const normalizeSaleMoney = (sale) => {
  if (!NORMALIZE_DECIMAL_TO_NUMBER || !sale) return sale;
  const normalized = { ...sale };
  for (const key of ['totalBeforeDiscount', 'totalDiscount', 'vat', 'vatRate', 'totalAmount', 'paidAmount']) {
    if (key in normalized && normalized[key] != null) normalized[key] = toNum(normalized[key]);
  }
  if (Array.isArray(normalized.items)) {
    normalized.items = normalized.items.map(normalizeLineMoney);
  }
  if (Array.isArray(normalized.simpleItems)) {
    normalized.simpleItems = normalized.simpleItems.map(normalizeLineMoney);
  }
  normalized.saleLines = projectSaleLines(normalized);
  if (Array.isArray(normalized.payments)) {
    normalized.payments = normalized.payments.map(normalizePayment);
  }
  return normalized;
};

module.exports = {
  NORMALIZE_DECIMAL_TO_NUMBER,
  normalizeSaleMoney,
  resolveCanonicalTotalAmount,
  projectSaleLines,
  round2,
  toLocalRange,
  toNum,
};
