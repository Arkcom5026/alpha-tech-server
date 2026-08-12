'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const create = fs.readFileSync(path.join(__dirname, 'create/createCustomerReceiptController.js'), 'utf8');
const allocate = fs.readFileSync(path.join(__dirname, 'allocate/allocateCustomerReceiptController.js'), 'utf8');
const cancel = fs.readFileSync(path.join(__dirname, 'cancel/cancelCustomerReceiptController.js'), 'utf8');
const projection = fs.readFileSync(path.join(
  __dirname,
  '../../sales/completion/services/salePaymentPostingService.js',
), 'utf8');

test('legacy customer receipt creation cannot associate a customer from another branch', () => {
  assert.match(create, /where:\s*\{ id: customerId, branchId \}/);
  assert.match(create, /ไม่พบข้อมูลลูกค้าที่ต้องการรับชำระในสาขานี้/);
});

test('CMR customer money receipts cannot enter legacy receipt allocation or cancellation routes', () => {
  assert.match(allocate, /startsWith\('CMR-'\)/);
  assert.match(allocate, /CUSTOMER_MONEY_RECEIPT_LEGACY_ALLOCATION_FORBIDDEN/);
  assert.match(cancel, /startsWith\('CMR-'\)/);
  assert.match(cancel, /CUSTOMER_MONEY_RECEIPT_LEGACY_CANCEL_FORBIDDEN/);
});

test('legacy receipt allocation and cancellation serialize receipt and sale payment mutations', () => {
  assert.match(allocate, /pg_advisory_xact_lock\(\$\{-1006\}/);
  assert.match(cancel, /pg_advisory_xact_lock\(\$\{-1006\}/);
  assert.match(allocate, /currentPaymentState = await projectSalePaymentStatus\(tx, saleId\)/);
  assert.match(cancel, /acquireSalePaymentProjectionLock\(tx, saleId\)/);
  assert.match(cancel, /projectSalePaymentStatus\(tx, saleId\)/);
});

test('legacy receipt writers no longer mutate Sale paidAmount directly', () => {
  assert.doesNotMatch(allocate, /tx\.sale\.update/);
  assert.doesNotMatch(cancel, /tx\.sale\.update/);
});

test('unified sale payment projection includes active legacy receipt allocations', () => {
  assert.match(projection, /customerReceiptAllocation\.aggregate/);
  assert.match(projection, /receipt:\s*\{ status: \{ not: 'CANCELLED' \} \}/);
  assert.match(projection, /receiptAllocationAggregate\._sum\.amount/);
  assert.match(projection, /findLatestActiveReceiptAllocation/);
});
