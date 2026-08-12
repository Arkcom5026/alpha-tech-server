'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const service = fs.readFileSync(path.join(__dirname, 'createCustomerMoneyApplicationService.js'), 'utf8');
const projection = fs.readFileSync(path.join(
  __dirname,
  '../../sales/completion/services/salePaymentPostingService.js',
), 'utf8');

test('legacy CUSTOMER_DEPOSIT to SALE application is tenant scoped and outstanding guarded', () => {
  assert.match(service, /sourceType === 'CUSTOMER_DEPOSIT'/);
  assert.match(service, /targetType === 'SALE'/);
  assert.match(service, /id: saleId,[\s\S]*branchId,[\s\S]*customerId,[\s\S]*status: \{ not: 'CANCELLED' \}/);
  assert.match(service, /currentPaymentState = await projectSalePaymentStatus\(client, saleId\)/);
  assert.match(service, /CUSTOMER_MONEY_APPLICATION_EXCEEDS_OUTSTANDING/);
});

test('sale application acquires projection before create and reprojects after create', () => {
  const beforeIndex = service.indexOf('currentPaymentState = await projectSalePaymentStatus');
  const createIndex = service.indexOf('customerMoneyApplication.create');
  const afterIndex = service.lastIndexOf('await projectSalePaymentStatus');
  assert.ok(beforeIndex >= 0 && createIndex > beforeIndex, 'projection must guard outstanding before application write');
  assert.ok(afterIndex > createIndex, 'sale must be reprojected after application write');
});

test('unified sale payment projection includes applied legacy deposit sale applications', () => {
  assert.match(projection, /customerMoneyApplication\.aggregate/);
  assert.match(projection, /sourceType: 'CUSTOMER_DEPOSIT'/);
  assert.match(projection, /targetType: 'SALE'/);
  assert.match(projection, /status: 'APPLIED'/);
  assert.match(projection, /depositApplicationAggregate\._sum\.amount/);
});
