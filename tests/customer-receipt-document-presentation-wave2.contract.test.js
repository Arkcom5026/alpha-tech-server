'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const schema = read('prisma/platform/document-presentation-snapshot.prisma');
const service = read('src/modules/finance/customer-receipt/presentation/customerReceiptPresentationSnapshotService.js');
const createController = read('src/modules/finance/customer-receipt/create/createCustomerReceiptController.js');
const detailController = read('src/modules/finance/customer-receipt/query/detail/getCustomerReceiptByIdController.js');

assert.match(schema, /model DocumentPresentationSnapshot/, 'Customer Receipt must reuse the generic presentation snapshot ledger');
assert.doesNotMatch(schema, /CustomerReceiptPresentationSnapshot/, 'Wave 2 must not create a receipt-specific snapshot table');

assert.match(service, /ensureCustomerReceiptPresentationSnapshot/);
assert.match(service, /sourceType:\s*'CUSTOMER_RECEIPT'/);
assert.match(service, /documentPurpose:\s*'CUSTOMER_RECEIPT'/);
assert.match(service, /rendererFamily:\s*'A4'/);
assert.match(service, /getOrCreatePresentationSnapshot/);
assert.match(service, /tx,/);
assert.match(service, /source\.receivedAt \|\| source\.createdAt/);

assert.match(createController, /prisma\.\$transaction\(async \(tx\) =>/);
assert.match(createController, /const receipt = await tx\.customerReceipt\.create/);
assert.match(createController, /ensureCustomerReceiptPresentationSnapshot\(\{\s*tx,\s*branchId,\s*receipt,/s, 'creation and presentation freeze must share one Prisma transaction');
assert.match(createController, /presentationSnapshot:\s*result\.presentationRecord\.snapshot/);

assert.match(detailController, /ensureCustomerReceiptPresentationSnapshot/);
assert.match(detailController, /presentationSnapshot:\s*presentationRecord\.snapshot/);
assert.match(detailController, /where:\s*\{ id: receiptId, branchId \}/, 'legacy snapshot backfill must remain tenant-scoped');

console.log('customer-receipt-document-presentation-wave2.contract.test.js: PASS');
