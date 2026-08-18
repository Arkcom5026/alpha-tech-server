'use strict';

const fs = require('fs');
const path = require('path');
const { buildCustomerFullAddress, customerFields } = require('../src/modules/quotation/quotationCustomerSnapshot');

const root = path.join(__dirname, '..');
const service = fs.readFileSync(path.join(root, 'src/modules/quotation/quotationService.js'), 'utf8');

const sample = {
  id: 101,
  name: 'ต้น',
  companyName: 'โรงพยาบาลบรรพตพิสัย',
  departmentName: 'พัสดุ',
  taxId: '0123456789012',
  addressDetail: '700 หมู่ 2',
  paymentTerms: 30,
  user: { loginId: '0864467104', email: 'customer@example.com' },
  subdistrict: {
    nameTh: 'ตาขีด',
    postcode: '60180',
    district: {
      nameTh: 'บรรพตพิสัย',
      province: { nameTh: 'นครสวรรค์' },
    },
  },
};

const expectedAddress = '700 หมู่ 2 ต.ตาขีด อ.บรรพตพิสัย จ.นครสวรรค์ 60180';
if (buildCustomerFullAddress(sample) !== expectedAddress) {
  throw new Error(`Expected full quotation customer address: ${expectedAddress}`);
}

const fields = customerFields(sample);
if (fields.customerAddress !== expectedAddress) throw new Error('Quotation snapshot must persist the full customer address');
if (fields.customerPhone !== '0864467104') throw new Error('Quotation snapshot must persist customer phone');
if (fields.customerTaxId !== '0123456789012') throw new Error('Quotation snapshot must persist customer tax id');
if (!fields.customerSnapshot?.subdistrict?.district?.province?.nameTh) throw new Error('Quotation snapshot must retain geographic source fields');

for (const token of [
  'subdistrict:',
  'postcode: true',
  'district:',
  'province: { select: { nameTh: true } }',
  'const selectedCustomerFields = snapshot ? customerFields(snapshot) : {};',
]) {
  if (!service.includes(token)) throw new Error(`Quotation customer snapshot authority missing: ${token}`);
}

if (service.includes("Number(patch.customerId) !== Number(quotation.customerId)")) {
  throw new Error('Draft customer snapshot must refresh even when the same customer is selected again');
}

console.log('Quotation Customer Snapshot Address Contract: PASS');
