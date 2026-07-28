'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const repository = read('src/modules/sales/storefront/checkout/storefrontCheckoutEligibilityRepository.js');
const service = read('src/modules/sales/storefront/checkout/storefrontCheckoutEligibilityService.js');
const createService = read('src/modules/sales/reservation/create/productReservationCreateService.js');

assert(repository.includes('FROM "PartnerStoreCapability"'));
assert(repository.includes('FROM "PartnerStoreServiceArea"'));
assert(repository.includes('"active" = TRUE'));

assert(service.includes("['MARKETPLACE', 'STOREFRONT']"));
assert(service.includes('STOREFRONT_CHECKOUT_UNAVAILABLE'));
assert(service.includes('STOREFRONT_BRANCH_MISMATCH'));
assert(service.includes('STOREFRONT_PICKUP_UNAVAILABLE'));
assert(service.includes('STOREFRONT_DELIVERY_UNAVAILABLE'));
assert(service.includes('STOREFRONT_SERVICE_AREA_UNAVAILABLE'));
assert(service.includes('STOREFRONT_DELIVERY_DISTANCE_REQUIRED'));
assert(service.includes("policy.serviceAreaMode === 'ADMIN_AREAS'"));
assert(service.includes("policy.serviceAreaMode === 'DISTANCE'"));
assert(service.includes("deliveryFeeMode === 'FIXED' ? Number(policy.fixedDeliveryFee) : 0"));

assert(createService.includes("require('../../storefront/checkout/storefrontCheckoutEligibilityService')"));
assert(createService.includes('await evaluateStorefrontCheckout'));
assert(createService.includes('deliveryFeeMode: checkoutAgreement.deliveryFeeMode'));
assert(createService.includes('deliveryFee: checkoutAgreement.deliveryFee'));
assert(!createService.includes('deliveryFeeMode: input.deliveryFeeMode'));

console.log('storefront checkout eligibility contract: PASS');
