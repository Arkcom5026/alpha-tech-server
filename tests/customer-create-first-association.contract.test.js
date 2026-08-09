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
const repository = fs.readFileSync(
  path.join(root, 'src/modules/customer/create/customerCreateRepository.js'),
  'utf8'
);

assert.match(controller, /branchId: Number\(req\.user\?\.branchId\)/);
assert.match(controller, /employeeId: Number\(/);
assert.match(service, /issueCustomerFirstAssociationToken/);
assert.match(service, /firstAssociationToken/);
assert.match(service, /repository\.findCustomerByUserAndBranch/);
assert.match(service, /repository\.createCustomerProfile/);
assert.doesNotMatch(service, /prisma\./);
assert.doesNotMatch(service, /branchId\s*=\s*input/);
assert.match(repository, /branchId_userId/);
assert.match(repository, /branchId:\s*Number\(branchId\)/);

console.log('customer-create-first-association.contract: PASS');
