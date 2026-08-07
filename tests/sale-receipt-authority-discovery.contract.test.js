'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const printablePaymentsController = read(
  'src/modules/sales/payment/query/printable/searchPrintablePaymentsController.js',
);
const paymentRoutes = read('src/modules/sales/payment/routes/paymentRoutes.js');
const customerReceiptRoutes = read(
  'src/modules/finance/customer-receipt/routes/customerReceiptRoutes.js',
);

// SALE_RECEIPT discovery authority: printable sale receipts currently originate from
// branch-scoped Payment records linked to Sale, not from Finance CustomerReceipt.
assert.match(printablePaymentsController, /const branchId = Number\(req\.user\?\.branchId\)/);
assert.match(printablePaymentsController, /prisma\.payment\.findMany/);
assert.match(printablePaymentsController, /sale:\s*\{\s*is:\s*\{/);
assert.match(printablePaymentsController, /branchId,/);
assert.match(printablePaymentsController, /isCancelled:\s*false/);
assert.match(printablePaymentsController, /ไม่สามารถโหลดข้อมูลใบเสร็จได้/);
assert.match(paymentRoutes, /router\.get\('\/printable', searchPrintablePayments\)/);

// Finance CustomerReceipt is a separate receivable/allocation lifecycle and must not
// be silently treated as SALE_RECEIPT authority.
assert.match(customerReceiptRoutes, /searchAllocationCandidates/);
assert.match(customerReceiptRoutes, /allocateCustomerReceipt/);
assert.match(customerReceiptRoutes, /router\.post\('\/:id\/allocate', allocateCustomerReceipt\)/);
assert.doesNotMatch(customerReceiptRoutes, /searchPrintablePayments/);
assert.doesNotMatch(customerReceiptRoutes, /\/printable/);

console.log('Sale receipt authority discovery contract: PASS');
