'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

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

const exampleGross = 1000;
const exampleRate = 7;
const exampleVat = money(exampleGross * exampleRate / (100 + exampleRate));
const exampleTaxableBase = money(exampleGross - exampleVat);
if (exampleVat !== 65.42) throw new Error(`Expected VAT extracted from 1,000.00 to be 65.42, received ${exampleVat}`);
if (exampleTaxableBase !== 934.58) throw new Error(`Expected pre-VAT value to be 934.58, received ${exampleTaxableBase}`);

for (const token of [
  'schemaVersion: 2',
  'vatInclusive: true',
  'taxableBase: money(number(quotation.grandTotal) - number(quotation.vatAmount))',
]) {
  if (!snapshot.includes(token)) throw new Error(`VAT-inclusive issued snapshot contract missing: ${token}`);
}

console.log('Quotation VAT-Inclusive Pricing Contract: PASS');
