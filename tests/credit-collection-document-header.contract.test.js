'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const receiptRepository = read('src/modules/customer-money/receive/createCustomerMoneyReceiptRepository.js');
const settlementRepository = read('src/modules/customer-money/settlement/delivery-credit/deliveryCreditSettlementRepository.js');
const customerMoneySchema = read('prisma/customer/customer-money.prisma');

assert.match(receiptRepository, /documentHeaderConfig:\s*true/, 'Customer Money Receipt projection must expose the branch document header config');

assert.match(customerMoneySchema, /model CustomerMoneySettlement[\s\S]*?branchId\s+Int/, 'Delivery credit settlement persistence must retain scalar branch authority');
assert.doesNotMatch(customerMoneySchema, /model CustomerMoneySettlement[\s\S]*?\n\s+branch\s+Branch\b/, 'CustomerMoneySettlement must not be treated as if it has a Prisma Branch relation');
assert.doesNotMatch(settlementRepository, /settlementInclude\s*=\s*\{[\s\S]*?branch:\s*\{/, 'settlement include must not request the nonexistent Prisma branch relation');
assert.match(settlementRepository, /client\.branch\.findFirst/, 'Delivery credit settlement projection must hydrate Branch from scalar branchId');
assert.match(settlementRepository, /where:\s*\{\s*id:\s*branchId\s*\}/, 'Branch hydration must use the settlement tenant branch identity');
assert.match(settlementRepository, /branch:\s*branch\s*\|\|\s*null/, 'Delivery credit settlement response must preserve the established branch projection shape');
assert.match(settlementRepository, /documentHeaderConfig:\s*true/, 'Delivery credit settlement branch projection must expose documentHeaderConfig');
assert.match(settlementRepository, /isHeadOffice:\s*true/, 'Delivery credit settlement branch projection must preserve branch identity metadata');
assert.match(settlementRepository, /records\.map\(\(record\) => attachBranch\(record, branch\)\)/, 'settlement lists must hydrate the tenant Branch once instead of using N+1 queries');

console.log('Credit Collection Document Header Server Contract: PASS');
