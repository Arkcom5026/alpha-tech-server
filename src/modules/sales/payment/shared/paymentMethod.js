const ALLOWED_PAYMENT_METHODS = new Set([
  'CASH',
  'TRANSFER',
  'CARD',
  'DEPOSIT',
  'QR',
  'E_WALLET',
  'CHEQUE',
  'OTHER',
]);

const normalizePaymentMethod = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  if (raw === 'CREDIT') return 'CARD';
  return raw;
};

module.exports = {
  ALLOWED_PAYMENT_METHODS,
  normalizePaymentMethod,
};
