const IMMEDIATE_METHODS = new Set(['CASH', 'TRANSFER', 'CARD']);

const normalizeSalePaymentMethod = (method) => {
  const value = String(method || '').trim().toUpperCase();
  return value === 'CREDIT' ? 'CARD' : value;
};

const isImmediateSalePaymentMethod = (method) =>
  IMMEDIATE_METHODS.has(normalizeSalePaymentMethod(method));

module.exports = { normalizeSalePaymentMethod, isImmediateSalePaymentMethod };
