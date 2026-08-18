const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const support = fs.readFileSync(
  path.join(__dirname, '../src/modules/customer/shared/customerControllerSupport.js'),
  'utf8',
);
const createService = fs.readFileSync(
  path.join(__dirname, '../src/modules/customer/create/customerCreateService.js'),
  'utf8',
);

assert.match(support, /\^\\d\{9,10\}\$/);
assert.match(createService, /ต้องระบุชื่อและเบอร์โทร 9 หรือ 10 หลัก/);
assert.match(createService, /!name \|\| !isValidPhone\(normalizedPhone\)/);

console.log('Customer Phone 9/10 Standard Contract: PASS');
