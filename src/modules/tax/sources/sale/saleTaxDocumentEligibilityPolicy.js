'use strict';

const normalizePaymentStatus = (value) => String(value || '').trim().toUpperCase();

const isSaleTaxDocumentEligible = (sale = {}) => (
  normalizePaymentStatus(sale.statusPayment) === 'PAID'
);

const assertSaleTaxDocumentEligibility = (sale = {}) => {
  if (isSaleTaxDocumentEligible(sale)) return;

  throw Object.assign(
    new Error('Sale must be fully paid before it can enter tax intake'),
    {
      code: 'TAX_SOURCE_SALE_PAYMENT_REQUIRED',
      statusCode: 409,
    },
  );
};

module.exports = Object.freeze({
  assertSaleTaxDocumentEligibility,
  isSaleTaxDocumentEligible,
  normalizePaymentStatus,
});
