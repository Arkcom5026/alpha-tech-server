'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const schemaPath = path.join(root, 'prisma', 'commerce', 'sale-document-preparation.prisma');
const migrationPath = path.join(
  root,
  'prisma',
  'migrations',
  '20260820061500_sale_document_preparation_wave1',
  'migration.sql',
);
const servicePath = path.join(
  root,
  'src',
  'modules',
  'sales',
  'document-preparation',
  'documentPreparationService.js',
);
const controllerPath = path.join(
  root,
  'src',
  'modules',
  'sales',
  'document-preparation',
  'documentPreparationController.js',
);
const routesPath = path.join(root, 'src', 'modules', 'sales', 'routes', 'saleRoutes.js');

const schema = fs.readFileSync(schemaPath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');
const serviceSource = fs.readFileSync(servicePath, 'utf8');
const controllerSource = fs.readFileSync(controllerPath, 'utf8');
const routes = fs.readFileSync(routesPath, 'utf8');

const {
  normalizeManualLines,
  buildAgencyContext,
} = require(servicePath);

assert.match(schema, /model SaleDocumentPreparation\s*\{/);
assert.match(schema, /model SaleDocumentPreparationLine\s*\{/);
assert.match(schema, /@@unique\(\[branchId, sourceType, sourceId\]/);
assert.match(schema, /status\s+String\s+@default\("DRAFT"\)/);
assert.match(schema, /sourceTotal\s+Decimal/);
assert.match(schema, /documentTotal\s+Decimal/);
assert.match(schema, /agencyContext\s+Json\?/);
assert.match(schema, /finalSnapshot\s+Json\?/);
assert.match(schema, /onDelete: Cascade/);

for (const forbidden of [
  'productId',
  'stockItemId',
  'simpleLotId',
  'revisionNumber',
  'revisionRootId',
  'revisedFromId',
]) {
  assert.ok(!schema.includes(forbidden), `Wave 1 schema must not contain ${forbidden}`);
}

assert.match(migration, /CREATE TABLE "SaleDocumentPreparation"/);
assert.match(migration, /CREATE TABLE "SaleDocumentPreparationLine"/);
assert.match(migration, /SaleDocumentPreparation_branch_source_key/);
assert.ok(!/DROP TABLE|DROP COLUMN|ALTER COLUMN|TRUNCATE/i.test(migration), 'Wave 1 migration must stay additive');

assert.match(serviceSource, /where:\s*\{ id: saleId, branchId \}/);
assert.match(serviceSource, /DOCUMENT_PREPARATION_DELIVERY_NOTE_REQUIRED/);
assert.match(serviceSource, /sourceType: 'SALE'/);
assert.match(serviceSource, /preparation\.status !== 'DRAFT'/);
assert.match(serviceSource, /DOCUMENT_PREPARATION_IMMUTABLE/);
assert.match(serviceSource, /buildPreparationTaxProjection/);
assert.match(serviceSource, /saleDocumentPreparationLine\.deleteMany/);
assert.match(serviceSource, /saleDocumentPreparationLine\.createMany/);
assert.ok(!/prisma\.sale\.(update|updateMany|delete|deleteMany)/.test(serviceSource));
assert.ok(!/stock(Item|Movement|Balance)?\.(create|update|delete)/i.test(serviceSource));
assert.ok(!/customerMoney|payment\.(create|update|delete)/i.test(serviceSource));

assert.match(controllerSource, /require\('\.\.\/\.\.\/\.\.\/\.\.\/lib\/prisma'\)/);
assert.match(routes, /router\.post\('\/:id\/document-preparation'/);
assert.match(routes, /router\.get\('\/:id\/document-preparation'/);
assert.match(routes, /router\.put\('\/:id\/document-preparation\/lines'/);

const normalized = normalizeManualLines([
  { description: 'หมึกพิมพ์', quantity: 2, unitName: 'กล่อง', unitPrice: 750 },
  { description: 'กระดาษ', quantity: 1, unitName: 'ลัง', unitPrice: 500 },
]);
assert.deepStrictEqual(
  normalized.map((line) => ({ description: line.description, amount: line.amount, sortOrder: line.sortOrder })),
  [
    { description: 'หมึกพิมพ์', amount: 1500, sortOrder: 0 },
    { description: 'กระดาษ', amount: 500, sortOrder: 1 },
  ],
);
assert.ok(!Object.prototype.hasOwnProperty.call(normalized[0], 'productId'));
assert.ok(!Object.prototype.hasOwnProperty.call(normalized[0], 'stockItemId'));

const agency = buildAgencyContext({
  id: 91,
  type: 'GOVERNMENT',
  companyName: 'โรงเรียน A',
  departmentName: 'ฝ่ายธุรการ',
  name: 'นาย ก.',
  taxId: '1234567890123',
  addressDetail: 'ที่อยู่ตัวอย่าง',
});
assert.deepStrictEqual(agency, {
  customerId: 91,
  customerType: 'GOVERNMENT',
  organizationName: 'โรงเรียน A',
  departmentName: 'ฝ่ายธุรการ',
  contactName: 'นาย ก.',
  taxId: '1234567890123',
  address: 'ที่อยู่ตัวอย่าง',
});

console.log('Sale document preparation Wave 1 contract: PASS');
