const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseCompleteSaleCommand,
} = require('../src/modules/sales/completion/contracts/saleCompletionContract');
const {
  assertSaleReplayHash,
} = require('../src/modules/sales/completion/policies/saleIdempotencyPolicy');

const base = (overrides = {}) => ({
  commandId: 'sale-command-00000001',
  sale: {
    customerId: 10,
    totalBeforeDiscount: 107,
    totalDiscount: 0,
    vat: 7,
    vatRate: 7,
    totalAmount: 107,
    mode: 'CASH',
    items: [{ stockItemId: 1, productId: 2, basePrice: 107, vatAmount: 7, price: 107, discount: 0 }],
    ...overrides.sale,
  },
  payment: {
    paymentItems: [{ paymentMethod: 'CASH', amount: 107 }],
    ...overrides.payment,
  },
});

test('normalizes compatibility CARD/CREDIT vocabulary', () => {
  const command = parseCompleteSaleCommand(base({
    payment: { paymentItems: [{ paymentMethod: 'CREDIT', amount: 107 }] },
  }));
  assert.equal(command.payment.paymentItems[0].paymentMethod, 'CARD');
});

test('requires a customer for credit and rejects immediate credit payment', () => {
  assert.throws(
    () => parseCompleteSaleCommand(base({ sale: { mode: 'CREDIT', customerId: null }, payment: { paymentItems: [] } })),
    { code: 'CREDIT_CUSTOMER_REQUIRED' }
  );
  assert.throws(
    () => parseCompleteSaleCommand(base({ sale: { mode: 'CREDIT' } })),
    { code: 'CREDIT_IMMEDIATE_PAYMENT_FORBIDDEN' }
  );
});

test('supports credit with deposit and requires deposit identity', () => {
  const command = parseCompleteSaleCommand(base({
    sale: { mode: 'CREDIT' },
    payment: { paymentItems: [{ paymentMethod: 'DEPOSIT', amount: 50, customerDepositId: 7 }] },
  }));
  assert.equal(command.payment.total, 50);
  assert.throws(
    () => parseCompleteSaleCommand(base({
      sale: { mode: 'CREDIT' },
      payment: { paymentItems: [{ paymentMethod: 'DEPOSIT', amount: 50 }] },
    })),
    { code: 'DEPOSIT_ID_REQUIRED' }
  );
});

test('rejects duplicate stock and inconsistent totals', () => {
  const duplicate = base();
  duplicate.sale.items.push({ ...duplicate.sale.items[0] });
  assert.throws(() => parseCompleteSaleCommand(duplicate), { code: 'DUPLICATE_STOCK_ITEM' });
  assert.throws(() => parseCompleteSaleCommand(base({ sale: { totalAmount: 100 } })), { code: 'SALE_TOTAL_MISMATCH' });
});

test('stable request hash ignores object key insertion order', () => {
  const first = parseCompleteSaleCommand(base());
  const payload = base();
  payload.sale = Object.fromEntries(Object.entries(payload.sale).reverse());
  const second = parseCompleteSaleCommand(payload);
  assert.equal(first.requestHash, second.requestHash);
});

test('all replay paths reject a reused command with a different payload hash', () => {
  assert.doesNotThrow(() => assertSaleReplayHash({ storedHash: 'same', requestHash: 'same' }));
  assert.throws(
    () => assertSaleReplayHash({ storedHash: 'first', requestHash: 'changed' }),
    { status: 409, code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' }
  );
});
