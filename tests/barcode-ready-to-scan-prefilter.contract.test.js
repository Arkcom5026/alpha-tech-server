const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryPath = path.join(
  __dirname,
  '../src/modules/inventory/barcode/scan-serial/barcodeScanSerialRepository.js',
);
const servicePath = path.join(
  __dirname,
  '../src/modules/inventory/barcode/scan-serial/barcodeScanSerialService.js',
);

test('ready-to-scan repository uses a conservative DB candidate prefilter while service retains final pending authority', () => {
  const repositorySource = fs.readFileSync(repositoryPath, 'utf8');
  const serviceSource = fs.readFileSync(servicePath, 'utf8');

  assert.match(repositorySource, /pendingReceiptCandidateWhere/);
  assert.match(repositorySource, /status:\s*\{\s*not:\s*'SN_RECEIVED'\s*\}/);
  assert.match(repositorySource, /stockItemId:\s*null/);
  assert.match(repositorySource, /findReadyToScanSnReceipts[\s\S]*pendingReceiptCandidateWhere\(branchId\)/);
  assert.match(repositorySource, /findReadyToScanReceipts[\s\S]*pendingReceiptCandidateWhere\(branchId\)/);

  assert.match(serviceSource, /\.filter\(\(receipt\)\s*=>\s*receipt\.pendingSN\s*>\s*0\)/);
  assert.match(serviceSource, /\.filter\(\(receipt\)\s*=>\s*receipt\.pendingTotal\s*>\s*0\)/);
});
