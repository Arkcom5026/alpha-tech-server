'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const policyPath = path.join(root, 'src', 'modules', 'sales', 'document-preparation', 'documentPreparationPolicy.js');
const registrationPath = path.join(root, 'src', 'modules', 'tax', 'sources', 'document-preparation', 'registerDocumentPreparationTaxCandidatesService.js');
const candidateContractPath = path.join(root, 'src', 'modules', 'tax', 'candidates', 'contracts', 'taxCandidateContract.js');
const mapperPath = path.join(root, 'src', 'modules', 'tax', 'candidates', 'mapping', 'mapCandidateToTaxDocument.js');
const issuePath = path.join(root, 'src', 'modules', 'tax', 'documents', 'issue', 'issueOutputTaxDocumentService.js');
const routesPath = path.join(root, 'src', 'modules', 'sales', 'routes', 'saleRoutes.js');

const policySource = fs.readFileSync(policyPath, 'utf8');
const registrationSource = fs.readFileSync(registrationPath, 'utf8');
const candidateContractSource = fs.readFileSync(candidateContractPath, 'utf8');
const mapperSource = fs.readFileSync(mapperPath, 'utf8');
const issueSource = fs.readFileSync(issuePath, 'utf8');
const routesSource = fs.readFileSync(routesPath, 'utf8');

const { allocatePreparationVat } = require(policyPath);
const { buildPortionSnapshot, portionSourceId } = require(registrationPath);

const vat = allocatePreparationVat({
  sourceTotal: 5000,
  sourceTaxAmount: 327.10,
  inBudgetTotal: 4000,
  outOfBudgetTotal: 1000,
});
assert.strictEqual(vat.portions.length, 2);
assert.strictEqual(vat.portions[0].portion, 'IN_BUDGET');
assert.strictEqual(vat.portions[1].portion, 'OUT_OF_BUDGET');
assert.strictEqual(Number((vat.portions[0].taxAmount + vat.portions[1].taxAmount).toFixed(2)), 327.10);
assert.strictEqual(Number((vat.portions[0].totalAmount + vat.portions[1].totalAmount).toFixed(2)), 5000);
assert.strictEqual(portionSourceId(77, 'IN_BUDGET'), '77:IN_BUDGET');
assert.strictEqual(portionSourceId(77, 'OUT_OF_BUDGET'), '77:OUT_OF_BUDGET');

const lockedSnapshot = {
  schemaVersion: 1,
  preparationId: 77,
  source: {
    saleId: 123,
    saleCode: 'SALE-123',
    deliveryNoteNumber: 'DN-SALE-123',
    totalAmount: 5000,
    taxAmount: 327.10,
    vatRate: 7,
  },
  agency: {
    organizationName: 'โรงเรียน A',
    contactName: 'นาย ก.',
    taxId: '1234567890123',
    address: 'ที่อยู่หน่วยงาน',
  },
  lines: [
    { description: 'หมึกพิมพ์', quantity: 2, unitName: 'กล่อง', unitPrice: 1500, amount: 3000 },
    { description: 'กระดาษ', quantity: 1, unitName: 'ลัง', unitPrice: 1000, amount: 1000 },
  ],
  totals: { sourceTotal: 5000, inBudgetTotal: 4000, outOfBudgetTotal: 1000 },
  taxProjection: [
    { portion: 'IN_BUDGET', taxInvoiceKind: 'FULL', totalAmount: 4000 },
    { portion: 'OUT_OF_BUDGET', taxInvoiceKind: 'SHORT', totalAmount: 1000, lineType: 'SERVICE_ONLY' },
  ],
  vatAllocation: vat.portions,
  outOfBudgetService: {
    description: 'ค่าบริการ', quantity: 1, unitName: 'รายการ', unitPrice: 1000, amount: 1000, lineType: 'SERVICE_ONLY',
  },
  lockedAt: '2026-08-20T06:30:00.000Z',
};

const full = buildPortionSnapshot({ finalSnapshot: lockedSnapshot, portion: 'IN_BUDGET' });
assert.strictEqual(full.requiredTaxInvoiceKind, 'FULL');
assert.strictEqual(full.totalAmount, 4000);
assert.strictEqual(full.recipient.legalName, 'โรงเรียน A');
assert.strictEqual(full.items.length, 2);

const short = buildPortionSnapshot({ finalSnapshot: lockedSnapshot, portion: 'OUT_OF_BUDGET' });
assert.strictEqual(short.requiredTaxInvoiceKind, 'SHORT');
assert.strictEqual(short.totalAmount, 1000);
assert.strictEqual(short.recipient, null);
assert.strictEqual(short.counterpartyTaxId, null);
assert.strictEqual(short.items.length, 1);
assert.strictEqual(short.items[0].description, 'ค่าบริการ');
assert.strictEqual(short.items[0].lineType, 'SERVICE_ONLY');

assert.match(candidateContractSource, /'DOCUMENT_PREPARATION'/);
assert.match(mapperSource, /DOCUMENT_PREPARATION: 'OUTPUT_TAX_INVOICE'/);
assert.match(registrationSource, /sourceType: 'DOCUMENT_PREPARATION'/);
assert.match(registrationSource, /DOCUMENT_PREPARATION_SOURCE_TAX_ALREADY_ISSUED/);
assert.match(registrationSource, /isolationLevel: Prisma\.TransactionIsolationLevel\.Serializable/);
assert.match(registrationSource, /portions = \['IN_BUDGET'\]/);
assert.match(registrationSource, /portions\.push\('OUT_OF_BUDGET'\)/);
assert.ok(!/sale\.(create|update|updateMany|delete|deleteMany)\(/.test(registrationSource));
assert.ok(!/stock(Item|Movement|Balance)?\.(create|update|delete)/i.test(registrationSource));
assert.ok(!/customerMoney|payment\.(create|update|delete)/i.test(registrationSource));

assert.match(issueSource, /candidate\?\.sourceType === 'DOCUMENT_PREPARATION'/);
assert.match(issueSource, /TAX_DOCUMENT_PREPARATION_KIND_MISMATCH/);
assert.match(issueSource, /TAX_SOURCE_PREPARATION_AUTHORITY_ACTIVE/);
assert.match(issueSource, /const assertNoPreparationTaxAuthorityForSaleIds/);
assert.match(issueSource, /sourceId: \{ startsWith: `\$\{preparation\.id\}:` \}/);
assert.match(routesSource, /document-preparation\/tax-candidates/);
assert.match(policySource, /sourceTaxAmount/);
assert.match(policySource, /vatAllocation/);

console.log('Sale document preparation Wave 4 contract: PASS');
