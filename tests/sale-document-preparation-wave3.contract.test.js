'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const policyPath = path.join(root, 'src', 'modules', 'sales', 'document-preparation', 'documentPreparationPolicy.js');
const servicePath = path.join(root, 'src', 'modules', 'sales', 'document-preparation', 'documentPreparationService.js');
const routesPath = path.join(root, 'src', 'modules', 'sales', 'routes', 'saleRoutes.js');
const policySource = fs.readFileSync(policyPath, 'utf8');
const serviceSource = fs.readFileSync(servicePath, 'utf8');
const routes = fs.readFileSync(routesPath, 'utf8');
const { buildLockedPreparationSnapshot } = require(policyPath);

const snapshot = buildLockedPreparationSnapshot({
  preparationId: 77,
  sourceSale: {
    id: 123,
    code: 'SALE-123',
    officialDocumentNumber: 'DN-SALE-123',
  },
  sourceTotal: 5000,
  agencyContext: {
    organizationName: 'โรงเรียน A',
    contactName: 'นาย ก.',
  },
  lines: [
    { description: 'หมึกพิมพ์', quantity: 2, unitName: 'กล่อง', unitPrice: 1500, amount: 3000, sortOrder: 0 },
    { description: 'กระดาษ', quantity: 1, unitName: 'ลัง', unitPrice: 1000, amount: 1000, sortOrder: 1 },
  ],
  lockedAt: '2026-08-20T06:30:00.000Z',
  lockedById: 35,
});

assert.strictEqual(snapshot.schemaVersion, 1);
assert.strictEqual(snapshot.source.totalAmount, 5000);
assert.strictEqual(snapshot.totals.inBudgetTotal, 4000);
assert.strictEqual(snapshot.totals.outOfBudgetTotal, 1000);
assert.strictEqual(snapshot.taxProjection.length, 2);
assert.strictEqual(snapshot.taxProjection[0].taxInvoiceKind, 'FULL');
assert.strictEqual(snapshot.taxProjection[1].taxInvoiceKind, 'SHORT');
assert.strictEqual(snapshot.outOfBudgetService.lineType, 'SERVICE_ONLY');
assert.strictEqual(snapshot.outOfBudgetService.description, 'ค่าบริการ');
assert.strictEqual(snapshot.outOfBudgetService.amount, 1000);
assert.ok(!Object.prototype.hasOwnProperty.call(snapshot.lines[0], 'productId'));
assert.ok(!Object.prototype.hasOwnProperty.call(snapshot.lines[0], 'stockItemId'));
assert.ok(!Object.prototype.hasOwnProperty.call(snapshot.lines[0], 'simpleLotId'));

for (const forbidden of ['revisionNumber', 'revisionRootId', 'revisedFromId']) {
  assert.ok(!JSON.stringify(snapshot).includes(forbidden));
  assert.ok(!policySource.includes(forbidden));
}

assert.match(policySource, /OUT_OF_BUDGET_SERVICE_DESCRIPTION = 'ค่าบริการ'/);
assert.match(policySource, /DOCUMENT_PREPARATION_LINES_REQUIRED_FOR_LOCK/);
assert.match(serviceSource, /const lockSaleDocumentPreparation = async/);
assert.match(serviceSource, /preparation\.status === 'LOCKED'/);
assert.match(serviceSource, /DOCUMENT_PREPARATION_SOURCE_TOTAL_CHANGED/);
assert.match(serviceSource, /where: \{ id: preparation\.id, status: 'DRAFT' \}/);
assert.match(serviceSource, /status: 'LOCKED'/);
assert.match(serviceSource, /finalSnapshot,/);
assert.match(serviceSource, /lockedAt,/);
assert.ok(!/sale\.(update|updateMany|delete|deleteMany)\(/.test(serviceSource));
assert.ok(!/stock(Item|Movement|Balance)?\.(create|update|delete)/i.test(serviceSource));
assert.match(routes, /router\.post\('\/:id\/document-preparation\/lock'/);

assert.throws(
  () => buildLockedPreparationSnapshot({
    preparationId: 78,
    sourceSale: { id: 124 },
    sourceTotal: 1000,
    lines: [],
  }),
  (error) => error?.code === 'DOCUMENT_PREPARATION_LINES_REQUIRED_FOR_LOCK',
);

console.log('Sale document preparation Wave 3 contract: PASS');
