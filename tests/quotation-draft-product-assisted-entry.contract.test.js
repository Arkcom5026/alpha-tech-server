'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const includes = (source, token) => {
  if (!source.includes(token)) throw new Error(`Missing quotation product-assisted authority contract: ${token}`);
};

const contract = read('src/modules/quotation/quotationContract.js');
const service = read('src/modules/quotation/quotationService.js');
const schema = read('prisma/commerce/quotation.prisma');
const productPosService = read('src/modules/product/posQuery/services/productPosQueryService.js');

for (const token of [
  "sourceType: sourceProductId ? 'PRODUCT_ASSISTED' : 'MANUAL'",
  "sourceProductId = optionalPositiveInt(input.sourceProductId, 'sourceProductId')",
  'quantity: quantity(input.quantity)',
  "unitPrice: money(input.unitPrice, 'unitPrice')",
  'discountAmount: 0',
]) includes(contract, token);

for (const token of [
  'const payload = contract.linePayload(input);',
  'tx.quotationItem.create',
  'data: { ...payload, discountAmount, lineSubtotal, lineTotal, quotationId: quotation.id }',
]) includes(service, token);

for (const token of [
  'PRODUCT_ASSISTED',
  'sourceProductId Int?',
  'sourceType      QuotationLineSource @default(MANUAL)',
]) includes(schema, token);

for (const token of [
  "readyOnly = 'false'",
  "hasPrice = 'false'",
  "if (String(readyOnly).toLowerCase() === 'true')",
  "if (String(hasPrice).toLowerCase() === 'true')",
]) includes(productPosService, token);

if (/reserve|reservation|stockItemId|simpleLotId/i.test(contract)) {
  throw new Error('Quotation line contract must not require stock or reservation identity');
}

console.log('Quotation Draft Product-Assisted Entry Server Contract: PASS');
