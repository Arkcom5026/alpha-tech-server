const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const salesReportController = read('src/modules/reporting/sales/runtime/salesReportRuntimeController.js');
const barcodeReceiptQuery = read('src/modules/inventory/barcode/receipt-query/getBarcodesByReceiptIdService.js');
const barcodeGenerationService = read('src/modules/inventory/barcode/generation/generateMissingBarcodesService.js');
const readyToSellService = read('src/modules/product/readyToSell/services/readyToSellService.js');

assert.equal(
  salesReportController.includes('res.status(result.status).json(result.body)'),
  false,
  'sales report runtime controller must not treat raw service projections as HTTP envelopes',
);
assert.match(salesReportController, /return res\.json\(result\);/);
assert.match(salesReportController, /result\?\.invalidDate/);
assert.match(salesReportController, /res\.status\(400\)\.json/);

assert.equal(
  barcodeReceiptQuery.includes('generationService.generateMissingBarcodes('),
  false,
  'receipt query must not call the retired generator method name',
);
assert.match(barcodeReceiptQuery, /generationService\.executeGenerateMissingBarcodes\(/);
assert.match(barcodeGenerationService, /executeGenerateMissingBarcodes/);

assert.match(readyToSellService, /const resolveSellablePrices =/);
assert.match(readyToSellService, /if \(!prices\) return \[\]/);

console.log('Render log error archaeology Wave 1 contract: PASS');
