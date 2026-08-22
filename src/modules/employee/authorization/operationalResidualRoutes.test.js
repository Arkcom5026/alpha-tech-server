'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

test('communication policy delegates authority to operational position capability resolver', () => {
  const source = read('src/modules/communication/communicationAccessPolicy.js');
  assert.match(source, /OPERATIONAL_RESIDUAL_CAPABILITIES\.COMMUNICATION_ACCESS/);
  assert.match(source, /OPERATIONAL_RESIDUAL_CAPABILITIES\.COMMUNICATION_PROFILE_MANAGE/);
  assert.doesNotMatch(source, /OWNER|MANAGER|TECHNICIAN|CASHIER/);
});

test('store experience routes split read, manage and publish authority', () => {
  const draft = read('src/modules/storeExperience/draft/storeExperienceDraftRoutes.js');
  const media = read('src/modules/storeExperience/media/storefrontMediaRoutes.js');
  assert.match(draft, /STORE_EXPERIENCE_CAPABILITY\.READ/);
  assert.match(draft, /STORE_EXPERIENCE_CAPABILITY\.MANAGE/);
  assert.match(draft, /STORE_EXPERIENCE_CAPABILITY\.PUBLISH/);
  assert.match(media, /STORE_EXPERIENCE_CAPABILITY\.READ/);
  assert.match(media, /STORE_EXPERIENCE_CAPABILITY\.MANAGE/);
  assert.doesNotMatch(draft, /allowEmployeeContext|employeeRole/);
  assert.doesNotMatch(media, /allowEmployeeContext|employeeRole/);
});

test('product trace policy uses position authority for employee trace and financial visibility', () => {
  const source = read('src/modules/product/trace/policies/productTracePolicy.js');
  assert.match(source, /OPERATIONAL_RESIDUAL_CAPABILITIES\.PRODUCT_TRACE_READ/);
  assert.match(source, /OPERATIONAL_RESIDUAL_CAPABILITIES\.PRODUCT_TRACE_FINANCIAL/);
  assert.doesNotMatch(source, /FINANCIAL_ROLES|FINANCIAL_EMPLOYEE_ROLES/);
});
