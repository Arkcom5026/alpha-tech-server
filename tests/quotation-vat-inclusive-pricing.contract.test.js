'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const service = read('src/modules/quotation/quotationService.js');
const snapshot = read('src/modules/quotation/quotationIssuedSnapshot.js');

for (const token of [
  'const grossTotal = Math.max(0, money(afterLineDiscount - billDiscount));',
  'grossTotal * vatRate / (100 + vatRate)',
  'const grandTotal = grossTotal;',
]) {
  if (!service.includes(token)) throw new Error(`VAT-inclusive quotation authority missing: ${token}`);
}

if (service.includes('const grandTotal = money(taxable + vatAmount);')) {
  throw new Error('Quotation must not add VAT on top of VAT-inclusive offered prices');
}

for (const token of [
  'schemaVersion: 2',
  'vatInclusive: true',
  'taxableBase: number(quotation.grandTotal) - number(quotation.vatAmount)',
]) {
  if (!snapshot.includes(token)) throw new Error(`VAT-inclusive issued snapshot contract missing: ${token}`);
}

console.log('Quotation VAT-Inclusive Pricing Contract: PASS');
