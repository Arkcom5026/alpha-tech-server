'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const controller = read('src/modules/product/quickStock/controllers/quickReceiptSessionController.js');
const publisher = read('src/modules/product/quickStock/services/publishQuickReceiptTaxCandidateService.js');
const adapter = read('src/modules/tax/sources/purchaseReceipt/registerPurchaseReceiptTaxCandidateService.js');
const taxEntry = read('src/modules/tax/index.js');

assert.match(controller, /publishQuickReceiptTaxCandidate/, 'Quick Receipt finalize must publish after inventory completion');
assert.match(controller, /taxIntake/, 'Finalize response must expose tax publication evidence');
assert.match(publisher, /status !== 'COMPLETED'/, 'Only committed receipts may publish');
assert.match(publisher, /taxMode !== 'RECEIVED'/, 'Pending or non-claim receipts must not create fake tax documents');
assert.match(publisher, /PENDING_RETRY/, 'Tax failure must not roll back committed inventory');
assert.match(adapter, /sourceType: 'PURCHASE_RECEIPT'/, 'Tax source identity must be PURCHASE_RECEIPT');
assert.match(adapter, /sourceId: `QUICK_RECEIPT:\$\{receiptId\}`/, 'Quick Receipt source identity must be stable');
assert.match(adapter, /documentType: 'INPUT_TAX_INVOICE'/, 'Received supplier invoices map to input tax invoices');
assert.match(adapter, /prisma\.supplier\.findFirst/, 'Supplier tax identity must come from the authoritative supplier record');
assert.match(taxEntry, /registerPurchaseReceiptCandidate/, 'Tax public entry must expose the purchase receipt adapter');

console.log('Tax Quick Receipt publication contract: PASS');
