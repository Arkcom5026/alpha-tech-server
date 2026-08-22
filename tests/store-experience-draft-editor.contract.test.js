'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const server = read('server.js');
const routes = read('src/modules/storeExperience/draft/storeExperienceDraftRoutes.js');
const controller = read('src/modules/storeExperience/draft/storeExperienceDraftController.js');
const service = read('src/modules/storeExperience/draft/storeExperienceDraftService.js');
const repository = read('src/modules/storeExperience/draft/storeExperienceDraftRepository.js');

assert.match(server, /app\.use\('\/api\/store-experience', storeExperienceDraftRoutes\)/);
assert.match(routes, /router\.use\(verifyToken\)/);
assert.match(routes, /router\.get\('\/draft', allowRead, controller\.getCurrentDraft\)/);
assert.match(routes, /router\.put\('\/draft', allowManage, controller\.saveCurrentDraft\)/);
assert.match(controller, /req\.employee\?\.branchId \|\| req\.user\?\.branchId/);
assert.doesNotMatch(controller, /req\.body\?\.branchId|req\.body\.branchId/);
assert.match(service, /THEME_PRESETS/);
assert.match(service, /LAYOUT_PRESETS/);
assert.match(service, /SECTION_TYPES/);
assert.match(service, /TOKEN_KEYS/);
assert.match(service, /STORE_EXPERIENCE_NOT_EDITABLE/);
assert.match(service, /\['DRAFT', 'READY', 'PUBLISHED'\]/);
assert.match(service, /!EDITABLE_STATUSES\.includes\(existing\.status\)/);
assert.match(service, /status: existing\?\.status \|\| 'DRAFT'/);
assert.match(repository, /storeExperienceProfile\.upsert/);
assert.match(repository, /create: \{ branchId, status: 'DRAFT'/);

console.log('store experience draft editor contract: PASS');
