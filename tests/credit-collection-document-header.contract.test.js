'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const receiptRepository = read('src/modules/customer-money/receive/createCustomerMoneyReceiptRepository.js');
const settlementRepository = read('src/modules/customer-money/settlement/delivery-credit/deliveryCreditSettlementRepository.js');

assert.match(receiptRepository, /documentHeaderConfig:\s*true/, 'Customer Money Receipt projection must expose the branch document header config');
assert.match(settlementRepository, /branch:\s*\{\s*select:/, 'Delivery credit settlement projection must expose its tenant branch');
assert.match(settlementRepository, /documentHeaderConfig:\s*true/, 'Delivery credit settlement branch projection must expose documentHeaderConfig');
assert.match(settlementRepository, /isHeadOffice:\s*true/, 'Delivery credit settlement branch projection must preserve branch identity metadata');

console.log('Credit Collection Document Header Server Contract: PASS');
