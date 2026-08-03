const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const controller = fs.readFileSync(
  path.join(root, 'src/modules/customer/create/customerCreateController.js'),
  'utf8'
);
const service = fs.readFileSync(
  path.join(root, 'src/modules/customer/create/customerCreateService.js'),
  'utf8'
);

assert.match(controller, /branchId: Number\(req\.user\?\.branchId\)/);
assert.match(controller, /employeeId: Number\(/);
assert.match(service, /issueCustomerFirstAssociationToken/);
assert.match(service, /firstAssociationToken/);
assert.match(service, /CUSTOMER_PHONE_NOT_AVAILABLE_IN_BRANCH/);
assert.match(service, /buildCustomerBranchAccessWhere/);
assert.doesNotMatch(service, /branchId\s*=\s*input/);

console.log('customer-create-first-association.contract: PASS');
