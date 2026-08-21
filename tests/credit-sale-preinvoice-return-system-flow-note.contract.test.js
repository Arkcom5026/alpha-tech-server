'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const note = fs.readFileSync(
  path.join(__dirname, '../docs/workflows/credit-sale-preinvoice-return-e2e.md'),
  'utf8',
);

assert.match(note, /SL-022608-0077/);
assert.match(note, /Original gross value:\s*`1,810\.00`/);
assert.match(note, /Returned value:\s*`640\.00`/);
assert.match(note, /Expected remaining receivable:\s*`1,170\.00`/);
assert.match(note, /Sale\.totalAmount.*immutable historical gross value/i);
assert.match(note, /No tax credit note is generated/);
assert.match(note, /document-only/);
assert.match(note, /never deducts stock again/);

console.log('credit-sale-preinvoice-return-system-flow-note.contract: PASS');
