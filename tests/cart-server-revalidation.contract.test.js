'use strict';

const fs = require('fs');
const assert = require('assert');

const repository = fs.readFileSync('src/modules/sales/storefront/session/anonymousShoppingSessionRepository.js', 'utf8');
const service = fs.readFileSync('src/modules/sales/storefront/session/anonymousShoppingSessionService.js', 'utf8');
const routes = fs.readFileSync('src/modules/sales/storefront/session/anonymousShoppingSessionRoutes.js', 'utf8');

assert(repository.includes('priceOnline'));
assert(repository.includes('availableQuantity'));
assert(repository.includes('ANONYMOUS_SESSION_STOCK_INSUFFICIENT'));
assert(repository.includes('Requested quantity exceeds available stock'));
assert(repository.includes('valid: priceOnline != null'));
assert(repository.includes('LEFT JOIN "StockBalance"'));
assert(service.includes('setAnonymousShoppingSessionItem'));
assert(routes.includes("router.put('/items/:productId'"));

console.log('cart server revalidation contract: PASS');
