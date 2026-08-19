'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

const repositorySource = read('createCustomerMoneyReceiptRepository.js');
const serviceSource = read('receiveCustomerMoneyService.js');

test('customer money receipt projection includes branch and employee document parties', () => {
  assert.match(repositorySource, /branch:\s*\{\s*select:/);
  assert.match(repositorySource, /isHeadOffice:\s*true/);
  assert.match(repositorySource, /createdByEmployeeProfile:\s*\{\s*select:/);
  assert.match(repositorySource, /cancelledByEmployeeProfile:\s*\{\s*select:/);
  assert.match(repositorySource, /addressDetail:\s*true/);
  assert.match(repositorySource, /loginId:\s*true/);
});

test('serialized receipt exposes enriched parties without changing receive semantics', () => {
  assert.match(serviceSource, /branch:\s*receipt\.branch\s*\|\|\s*null/);
  assert.match(serviceSource, /receivedBy:\s*receipt\.createdByEmployeeProfile/);
  assert.match(serviceSource, /cancelledBy:\s*receipt\.cancelledByEmployeeProfile/);
  assert.match(serviceSource, /eventType:\s*'MONEY_RECEIVED'/);
  assert.match(serviceSource, /CUSTOMER_MONEY_RECEIPT_SOURCE\s*=\s*'CUSTOMER_MONEY_RECEIPT'/);
  assert.match(serviceSource, /referenceType:\s*CUSTOMER_MONEY_RECEIPT_SOURCE/);
});

test('receipt history remains branch-scoped and CMR-only while supporting operational filters', () => {
  assert.match(repositorySource, /branchId,/);
  assert.match(repositorySource, /code:\s*\{\s*startsWith:\s*'CMR-'/);
  assert.match(repositorySource, /referenceNo:\s*\{\s*contains:\s*keyword/);
  assert.match(repositorySource, /companyName:\s*\{\s*contains:\s*keyword/);
  assert.match(repositorySource, /receivedAt/);
  assert.match(serviceSource, /RECEIPT_STATUSES/);
  assert.match(serviceSource, /PAYMENT_METHODS/);
  assert.match(serviceSource, /dateFrom:\s*parseHistoryDate/);
  assert.match(serviceSource, /dateTo:\s*parseHistoryDate/);
});
