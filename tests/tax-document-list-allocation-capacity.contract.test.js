'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'modules', 'tax', 'documents', 'repository', 'taxDocumentRepository.js'),
  'utf8',
);

test('tax document list projects active input-tax receipt allocation totals', () => {
  assert.match(source, /InputTaxDocumentReceiptLink/);
  assert.match(source, /link\."state" = 'ACTIVE'/);
  assert.match(source, /activeLinkedReceiptCount/);
  assert.match(source, /activeAllocatedSubtotal/);
  assert.match(source, /activeAllocatedVatAmount/);
  assert.match(source, /activeAllocatedTotalAmount/);
});

test('capacity fields are normalized to client-safe numbers', () => {
  assert.match(source, /activeLinkedReceiptCount: Number/);
  assert.match(source, /activeAllocatedSubtotal: Number/);
  assert.match(source, /activeAllocatedVatAmount: Number/);
  assert.match(source, /activeAllocatedTotalAmount: Number/);
});
