'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const service = fs.readFileSync(path.join(root, 'src/modules/quotation/quotationService.js'), 'utf8');

for (const token of [
  'const hydrateBranchDocumentAddress = (branch) => {',
  'subdistrict?.nameTh ? `ตำบล${subdistrict.nameTh}` : null',
  'district?.nameTh ? `อำเภอ${district.nameTh}` : null',
  'province?.nameTh ? `จังหวัด${province.nameTh}` : null',
  'subdistrict?.postcode || null',
  'subdistrict: {',
  'const documentHeaderSnapshot = hydrateBranchDocumentAddress(branch);',
]) {
  if (!service.includes(token)) {
    throw new Error(`Issued quotation header address authority missing: ${token}`);
  }
}

if (service.includes('const documentHeaderSnapshot = branch || null;')) {
  throw new Error('Issued quotation must not freeze a raw branch address without hydrated geography');
}

console.log('Quotation Issued Header Address Contract: PASS');
