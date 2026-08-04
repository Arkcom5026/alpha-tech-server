'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const routes = read('src/modules/storeExperience/draft/storeExperienceDraftRoutes.js');
const service = read('src/modules/storeExperience/draft/storeExperienceDraftService.js');
const repository = read('src/modules/storeExperience/draft/storeExperienceDraftRepository.js');
const publicProjection = read('src/modules/sales/storefront/public/publicStorefrontRepository.js');

assert.match(routes, /router\.post\('\/publish'/, 'publish route must exist');
assert.match(routes, /router\.post\('\/unpublish'/, 'unpublish route must exist');
assert.match(service, /STOREFRONT_SLUG_REQUIRED/, 'publish must require slug');
assert.match(service, /STOREFRONT_DISPLAY_NAME_REQUIRED/, 'publish must require display name');
assert.match(service, /STORE_EXPERIENCE_SECTION_REQUIRED/, 'publish must require enabled section');
assert.match(repository, /status: 'PUBLISHED'/, 'publish must persist PUBLISHED');
assert.match(repository, /storefrontEnabled: true/, 'publish must enable storefront capability');
assert.match(repository, /status: 'DRAFT'/, 'unpublish must return to DRAFT');
assert.match(repository, /storefrontEnabled: false/, 'unpublish must disable public capability');
assert.match(publicProjection, /experience\."status" = 'PUBLISHED'/, 'public projection must require PUBLISHED');

console.log('store experience publish lifecycle contract: PASS');
