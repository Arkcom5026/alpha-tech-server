'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const routes = read('src/modules/sales/reservation/routes/productReservationRoutes.js');
const convertService = read('src/modules/sales/reservation/convert/productReservationConvertService.js');
const convertRepository = read('src/modules/sales/reservation/convert/productReservationConvertRepository.js');
const completionService = read('src/modules/sales/completion/services/saleCompletionService.js');

assert.match(routes, /router\.post\('\/:id\/convert-to-sale', convertProductReservationToSaleController\)/);
assert.match(convertService, /parseCompleteSaleCommand/);
assert.match(convertService, /completeSale\(\{/);
assert.match(convertService, /sourceType: 'PRODUCT_RESERVATION'/);
assert.match(convertService, /RESERVATION_DEPOSIT_NOT_POSTED/);
assert.match(convertService, /RESERVATION_INCONSISTENT_STATE/);
assert.match(convertService, /const isConverted = reservation\.convertedSaleId != null/);
assert.doesNotMatch(convertService, /RESERVATION_ALREADY_CONVERTED/);
assert.match(convertRepository, /ProductReservationItem/);
assert.match(convertRepository, /"isActive" = TRUE OR/);
assert.match(convertRepository, /convertedSaleId != null/);
assert.match(completionService, /loadReservationAllocation/);
assert.match(completionService, /FOR UPDATE/);
assert.match(completionService, /reserved: \{ decrement: D\(required\) \}/);
assert.match(completionService, /quantity: \{ decrement: D\(required\) \}/);
assert.match(completionService, /convertedSaleId: sale\.id/);
assert.match(completionService, /status: 'COMPLETED'/);
assert.match(completionService, /isActive: false/);
assert.match(completionService, /reservationAllocation \?/);
assert.match(completionService, /available = Number\(balance\?\.quantity \|\| 0\) - Number\(balance\?\.reserved \|\| 0\) \+ ownedReserved/);
assert.match(completionService, /type: 'SALE'/);
assert.doesNotMatch(convertService, /tx\.sale\.create/);
assert.doesNotMatch(convertRepository, /sale\.create/);

console.log('Product reservation conversion contract: PASS');
