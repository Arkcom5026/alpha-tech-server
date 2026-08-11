'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const test = require('node:test');

const root = process.cwd();
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const routes = read('src', 'modules', 'customer', 'routes', 'customerRoutes.js');
const controller = read('src', 'modules', 'customer', 'management', 'customerManagementController.js');
const service = read('src', 'modules', 'customer', 'management', 'customerManagementService.js');
const repository = read('src', 'modules', 'customer', 'management', 'customerManagementRepository.js');

test('customer management exposes branch-scoped detail authority', () => {
  assert.match(routes, /router\.get\('\/management\/:id'/);
  assert.match(controller, /getCustomerDetail/);
  assert.match(service, /getCustomerDetail/);
  assert.match(repository, /findCustomerDetail/);
});

test('detail projection includes tax and authoritative address fields', () => {
  for (const field of ['taxId', 'type', 'companyName', 'addressDetail', 'subdistrictCode']) {
    assert.match(service, new RegExp(field));
  }
  assert.match(repository, /subdistrict:\s*\{\s*include:\s*\{\s*district:/);
});

test('detail authority rejects cross-branch customer reads', () => {
  assert.match(service, /CUSTOMER_DETAIL_BRANCH_FORBIDDEN/);
  assert.match(service, /customer\.branchId !== authorized\.context\.branchId/);
});
