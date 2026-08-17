'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const eligibleService = fs.readFileSync(
  path.join(root, 'src/modules/customer-money/settlement/delivery-credit/listEligibleDeliveryCreditsService.js'),
  'utf8',
);
const sourcePoolTest = fs.readFileSync(
  path.join(root, 'src/modules/customer-money/balance/customerMoneySourcePoolService.test.js'),
  'utf8',
);

assert.match(eligibleService, /const group = await resolveFinancialCustomerGroup/, 'eligible settlement query must resolve one financial group authority');
assert.match(
  eligibleService,
  /buildSpendableSourceState\(prisma, \{[\s\S]*branchId: command\.branchId,[\s\S]*customerId: command\.customerId,[\s\S]*financialGroup: group,[\s\S]*\}\)/,
  'eligible settlement balance must reuse the already-resolved financial group through spendable source authority',
);
assert.match(eligibleService, /customerId: group\.ownerId/, 'projected CustomerMoneyBalance lookup must remain keyed by the financial owner');
assert.match(eligibleService, /const availableAmount = sourceState\.availableAmount/, 'response available balance must come from spendable source authority');
assert.match(eligibleService, /sourceCount:/, 'response must expose source diagnostics for runtime verification');
assert.match(eligibleService, /sourceTotal:/, 'response must expose source total diagnostics for runtime verification');
assert.match(eligibleService, /financialOwnerId: group\.ownerId/, 'response must expose resolved financial owner authority');
assert.match(eligibleService, /sourceCustomerIds/, 'response must expose source customer lineage diagnostics');
assert.match(eligibleService, /projectionMatchesSource/, 'response must continue exposing projection-vs-source consistency');
assert.match(sourcePoolTest, /reuses a pre-resolved financial group without re-querying customer profiles/, 'source pool must retain runtime coverage for pre-resolved group reuse');
assert.match(sourcePoolTest, /assert\.equal\(profileQueries, 0\)/, 'pre-resolved source-pool contract must prohibit duplicate customer-profile queries');

console.log('Customer Money Settlement Loading Authority Server Contract: PASS');
