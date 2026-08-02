'use strict';

const assertSaleTaxDocumentEligibility = (sale = {}) => {
  if (String(sale.statusPayment || '').trim().toUpperCase() === 'PAID') return;

  throw Object.assign(
    new Error('Sale must be fully paid before it can enter tax intake'),
    {
      code: 'TAX_SOURCE_SALE_PAYMENT_REQUIRED',
      statusCode: 409,
    },
  );
};

module.exports = Object.freeze({ assertSaleTaxDocumentEligibility });
