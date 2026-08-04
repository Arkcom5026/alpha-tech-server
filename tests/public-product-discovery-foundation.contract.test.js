'use strict';

const fs = require('fs');
const assert = require('assert');

const repository = fs.readFileSync('src/modules/sales/storefront/public/publicStorefrontRepository.js', 'utf8');
const service = fs.readFileSync('src/modules/sales/storefront/public/publicStorefrontService.js', 'utf8');
const controller = fs.readFileSync('src/modules/sales/storefront/public/publicStorefrontController.js', 'utf8');

assert(repository.includes('buildDiscoveryFilterSql'));
assert(repository.includes('categoryId'));
assert(repository.includes('brandId'));
assert(repository.includes("sort === 'price_asc'"));
assert(repository.includes('facets'));
assert(service.includes('SORT_OPTIONS'));
assert(service.includes('normalizeOptionalPositiveInt'));
assert(controller.includes('req.query?.categoryId'));
assert(controller.includes('req.query?.brandId'));
assert(controller.includes('req.query?.sort'));

console.log('public product discovery foundation contract: PASS');
