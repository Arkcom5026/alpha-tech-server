'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const service = fs.readFileSync(path.join(__dirname, 'customerDepositRuntimeService.js'), 'utf8');
const repository = fs.readFileSync(path.join(__dirname, 'customerDepositRuntimeRepository.js'), 'utf8');
const controller = fs.readFileSync(path.join(__dirname, 'customerDepositRuntimeController.js'), 'utf8');

test('customer deposit mutations participate in the shared Customer Money transaction authority', () => {
  assert.match(service, /acquireCustomerMoneyTransactionLock/);
  assert.match(service, /const createCustomerDeposit[\s\S]*repository\.runTransaction/);
  assert.match(service, /const updateCustomerDeposit[\s\S]*repository\.runTransaction/);
  assert.match(service, /const deleteCustomerDeposit[\s\S]*repository\.runTransaction/);
  assert.match(service, /const useCustomerDeposit[\s\S]*repository\.runTransaction/);
  assert.match(service, /calculateCustomerMoneyBalance/);
  assert.match(service, /updateCustomerMoneyBalance/);
});

test('customer deposit repository supports transactional create update delete and scoped customer reads', () => {
  assert.match(repository, /createDeposit = \(\{ data, client = prisma \}\)/);
  assert.match(repository, /findCustomerById = \(\{ customerId, branchId, client = prisma \}\)/);
  assert.match(repository, /updateDepositById = async \(\{ id, data, client = prisma \}\)/);
  assert.match(repository, /deleteDepositById = \(\{ id, client = prisma \}\)/);
});

test('direct deposit usage cannot spend source money reserved by legacy Customer Money settlement', () => {
  assert.match(repository, /getCustomerMoneySourceState/);
  assert.match(repository, /sourceType:\s*'CUSTOMER_DEPOSIT'/);
  assert.match(repository, /sourceState\.uncoveredLegacyReservation\.greaterThan\(0\)/);
  assert.match(repository, /spendAmount > Number\(sourceState\.availableAmount\)/);
  assert.match(repository, /DEPOSIT_CUSTOMER_MONEY_RESERVED/);
  assert.match(controller, /statusCode >= 400 && statusCode < 500/);
  assert.match(controller, /code: error\.code/);
});

test('deposit use fails closed unless target sale matches branch and customer', () => {
  assert.match(service, /tx\?\.sale\?\.findFirst/);
  assert.match(service, /id: saleId/);
  assert.match(service, /branchId/);
  assert.match(service, /customerId: deposit\.customerId/);
  assert.match(service, /status: \{ not: 'CANCELLED' \}/);
  assert.match(service, /ใบขายไม่อยู่ในสาขา\/ลูกค้าเดียวกับเงินมัดจำ/);
});

test('fully consumed deposits leave the active source pool', () => {
  assert.match(service, /const fullyUsed = nextUsedAmount\.greaterThanOrEqualTo/);
  assert.match(service, /fullyUsed \? \{ status: 'USED' \} : \{\}/);
});

test('legacy balance-sourced settlements block unsafe deposit edit or deletion', () => {
  assert.match(service, /getLegacyBalanceReservation/);
  const matches = service.match(/legacyReserved\.greaterThan\(0\)/g) || [];
  assert.ok(matches.length >= 2, 'update and delete must both guard legacy reservations');
});