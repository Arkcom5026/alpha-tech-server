'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const projectionService = read(
  'src/modules/tax/documents/print/projectOutputTaxPrintableDocumentService.js',
);
const taxIntakeService = read('src/modules/tax/http/taxIntakeService.js');
const controller = read('src/modules/tax/http/taxIntakeController.js');
const routes = read('src/modules/tax/http/taxIntakeRoutes.js');

// Existing tax-print eligibility/lifecycle authority remains intact.
assert.match(projectionService, /document\.documentType !== 'OUTPUT_TAX_INVOICE'/);
assert.match(projectionService, /document\.status !== 'REGISTERED'/);
assert.match(projectionService, /document\.candidate\?\.sourceType !== 'SALE'/);
assert.match(projectionService, /sale\.paid !== true/);
assert.match(projectionService, /sale\.statusPayment !== 'PAID'/);
assert.match(projectionService, /invoiceKind === 'FULL' && !recipient/);

// FULL/SHORT identity now comes from the branch-scoped Document Purpose Registry.
assert.match(projectionService, /ResolvePrintDocumentPurposeService/);
assert.match(projectionService, /invoiceKind === 'FULL'/);
assert.match(projectionService, /FULL_TAX_INVOICE/);
assert.match(projectionService, /SHORT_TAX_INVOICE/);
assert.match(projectionService, /branchId:\s*normalizedBranchId/);
assert.match(projectionService, /code:\s*purposeCode/);
assert.match(projectionService, /type:\s*purpose\.code/);
assert.match(projectionService, /title:\s*purpose\.displayName/);

// Keep the printable API/service boundary unchanged for callers.
assert.match(taxIntakeService, /projectOutputTaxPrintableDocument,/);
assert.match(controller, /service\.projectOutputTaxPrintableDocument\(/);
assert.match(routes, /router\.get\('\/documents\/:taxDocumentId\/printable',\s*controller\.getPrintableOutputTaxDocument\)/);

// Registry/domain failures must flow through the existing error middleware unchanged,
// preserving their statusCode/code instead of being converted to a generic tax-print response.
assert.match(controller, /catch \(error\) \{\s*return next\(error\);\s*\}/s);

// The projection itself must no longer own localized FULL/SHORT titles.
assert.doesNotMatch(projectionService, /title:\s*invoiceKind/);
assert.doesNotMatch(projectionService, /title:\s*'ใบกำกับภาษี/);

console.log('Output tax document-purpose compatibility contract: PASS');
