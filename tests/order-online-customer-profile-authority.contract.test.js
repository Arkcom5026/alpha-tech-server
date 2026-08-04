const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const routes = read('src/modules/commerce/order-online/routes/orderOnlineRoutes.js');
const controllerPath = path.join(
  root,
  'src/modules/commerce/order-online/runtime/orderOnlineRuntimeController.js'
);
const controller = fs.readFileSync(controllerPath, 'utf8');
const readAuthority = read(
  'src/modules/commerce/order-online/runtime/orderOnlineCustomerAuthorityService.js'
);
const mutationAuthority = read(
  'src/modules/commerce/order-online/runtime/orderOnlineMutationAuthorityService.js'
);

assert.doesNotThrow(
  () => require(controllerPath),
  'order-online authority dependency graph must resolve at startup'
);

assert.match(routes, /router\.get\('\/my', getOrderOnlineByCustomer\)/);
assert.match(routes, /router\.get\('\/customer\/:id', getOrderOnlineByIdForCustomer\)/);
assert.match(routes, /router\.post\('\/:orderId\/payment-slip', submitOrderOnlinePaymentSlip\)/);
assert.match(routes, /router\.patch\('\/:id\/status', updateOrderOnlineStatus\)/);
assert.match(routes, /router\.delete\('\/:id', deleteOrderOnline\)/);

assert.match(controller, /customerProfileId:\s*req\.user\?\.customerProfileId/g);
assert.match(controller, /customerAuthorityService\.getOrderOnlineByCustomer/);
assert.match(controller, /customerAuthorityService\.getOrderOnlineByIdForCustomer/);
assert.match(controller, /mutationAuthorityService\.submitOrderOnlinePaymentSlip/);
assert.match(controller, /mutationAuthorityService\.updateOrderOnlineStatus/);
assert.match(controller, /mutationAuthorityService\.deleteOrderOnline/);

for (const source of [readAuthority, mutationAuthority]) {
  assert.match(source, /ACTIVE_CUSTOMER_PROFILE_REQUIRED/);
  assert.match(source, /CUSTOMER_PROFILE_NOT_AUTHORIZED/);
  assert.match(source, /id:\s*customerProfileId/);
  assert.match(source, /userId/);
  assert.doesNotMatch(source, /findCustomerProfileFirstByUserId/);
  assert.doesNotMatch(source, /findCustomerProfileByUserId/);
}

assert.match(readAuthority, /order\.customerId !== profile\.id/);
assert.match(readAuthority, /order\.branchId !== profile\.branchId/);
assert.match(mutationAuthority, /order\.customerId !== profile\.id/);
assert.match(mutationAuthority, /order\.branchId !== profile\.branchId/);
assert.match(mutationAuthority, /statusPayment === 'PAID'/);

console.log('order-online-customer-profile-authority.contract: PASS');
