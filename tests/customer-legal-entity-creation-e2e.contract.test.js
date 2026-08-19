'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const service = read('src/modules/customer/create/customerCreateService.js');
const repository = read('src/modules/customer/create/customerCreateRepository.js');
const routes = read('src/modules/customer/routes/customerRoutes.js');
const schema = read('prisma/customer/customer.prisma');

assert.match(service, /allowedTypes = new Set\(\['INDIVIDUAL', 'ORGANIZATION', 'GOVERNMENT'\]\)/);
assert.match(service, /legalEntityTypes = new Set\(\['ORGANIZATION', 'GOVERNMENT'\]\)/);
assert.match(service, /INVALID_CUSTOMER_TYPE/);
assert.match(service, /CUSTOMER_COMPANY_NAME_REQUIRED/);
assert.match(service, /กรุณาระบุชื่อบริษัทหรือหน่วยงาน/);
assert.match(service, /CUSTOMER_NAME_REQUIRED/);
assert.match(service, /name: normalizedName \|\| null/);
assert.match(service, /companyName: isLegalEntity \? normalizedCompanyName : null/);
assert.match(service, /departmentName: isLegalEntity/);
assert.match(service, /if \(!isValidPhone\(normalizedPhone\)\)/);

assert.match(repository, /name: customer\.name/);
assert.match(repository, /companyName: customer\.companyName \|\| null/);
assert.match(routes, /router\.post\('\/', customerCreateController\.createCustomer\)/);
assert.match(schema, /name\s+String\?/);
assert.match(schema, /companyName\s+String\?/);
assert.match(schema, /ORGANIZATION/);
assert.match(schema, /GOVERNMENT/);

assert.doesNotMatch(service, /if \(!name \|\| !isValidPhone\(normalizedPhone\)\)/);

console.log('Customer Legal Entity Creation E2E Server Contract: PASS');
