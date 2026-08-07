'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const scriptPath = path.join(
  __dirname,
  '..',
  'scripts',
  'verify-document-purpose-production-print-runtime.js',
);
const source = fs.readFileSync(scriptPath, 'utf8');

assert.match(source, /mode: 'READ_ONLY_PRODUCTION_PRINT_RUNTIME'/);
assert.match(source, /databaseModified: false/);
assert.match(source, /RECOVERY_HOST = 'db\.engqdeyzbvnmxbnpemau\.supabase\.co'/);
assert.match(source, /Recovery\/Test database detected; production verification refused/);

for (const code of [
  'SALE_RECEIPT',
  'DELIVERY_NOTE',
  'SHORT_TAX_INVOICE',
  'FULL_TAX_INVOICE',
]) {
  assert.ok(source.includes(`'${code}'`), `missing purpose coverage: ${code}`);
}

assert.match(source, /projectSaleDeliveryNote/);
assert.match(source, /searchPrintablePayments/);
assert.match(source, /projectOutputTaxPrintableDocument/);
assert.match(source, /SKIP_NO_PRINTABLE_DATA/);
assert.match(source, /SKIP_NO_ELIGIBLE_DATA/);
assert.match(source, /SKIP_NO_ISSUED_DATA/);
assert.match(source, /payload\.length === 0/);

for (const forbidden of [
  '.create(',
  '.createMany(',
  '.update(',
  '.updateMany(',
  '.delete(',
  '.deleteMany(',
  '.upsert(',
  '.$executeRaw',
  '.$executeRawUnsafe',
]) {
  assert.ok(!source.includes(forbidden), `read-only verifier contains write primitive: ${forbidden}`);
}

console.log('document-purpose-production-print-runtime.contract.test.js: PASS');
