'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const eligible = read('src/modules/customer-money/settlement/delivery-credit/listEligibleDeliveryCreditsService.js');
const pool = read('src/modules/customer-money/balance/customerMoneySourcePoolService.js');

assert.match(eligible, /buildSpendableSourceState/, 'eligible credits must use source-state authority, not a balance shortcut');
assert.match(eligible, /financialGroup:\s*group/, 'eligible credits must reuse the already-resolved financial group');
assert.match(eligible, /Promise\.all\(\[\s*salesPromise,\s*balancePromise,\s*sourceStatePromise/s, 'independent sales, balance and source-state reads must run in parallel');
assert.doesNotMatch(eligible, /const customer = await prisma\.customerProfile\.findFirst/, 'eligible credits must not re-query the selected customer after financial-group resolution');
assert.match(eligible, /group\.selectedCustomer/, 'selected customer must come from the resolved financial group');
assert.match(eligible, /settlement:\s*\{\s*branchId:\s*command\.branchId,\s*customerId:\s*group\.ownerId/s, 'prior settlement lines must remain branch/customer scoped');
assert.match(eligible, /sourceTotal:/, 'eligible response must expose source total diagnostics');
assert.match(eligible, /legacyReservedAmount:/, 'eligible response must expose legacy reservation diagnostics');
assert.match(eligible, /uncoveredLegacyReservation:/, 'eligible response must expose uncovered legacy reservation diagnostics');
assert.match(eligible, /spendableSourceCount:/, 'eligible response must expose spendable-source diagnostics');

assert.match(pool, /code:\s*\{\s*startsWith:\s*'CMR-'/, 'Customer Money Receipt sources must remain constrained to CMR authority');
assert.match(pool, /status:\s*'ACTIVE'/, 'active Customer Money Receipt sources must remain spendable');
assert.match(pool, /remainingAmount:\s*\{\s*gt:\s*0\s*\}/, 'only positive remaining receipt balances may be spent');

console.log('Customer Money Settlement Balance/Performance Contract: PASS');
