'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const routes = read('src/modules/tax/issuerProfile/routes/taxIssuerProfileRoutes.js');
const controller = read('src/modules/tax/issuerProfile/routes/taxIssuerProfileController.js');
const service = read('src/modules/tax/issuerProfile/update/upsertTaxIssuerProfileService.js');
const repository = read('src/modules/tax/issuerProfile/shared/taxIssuerProfileRepository.js');
const taxRoutes = read('src/modules/tax/http/taxIntakeRoutes.js');

assert.match(routes, /router\.get\('\/', allowTaxIssuerProfileRead/);
assert.match(routes, /router\.put\('\/', allowTaxIssuerProfileManage/);
assert.match(routes, /verifyToken/);
assert.match(routes, /TAX_ISSUER_PROFILE_CAPABILITY\.READ/);
assert.match(routes, /TAX_ISSUER_PROFILE_CAPABILITY\.MANAGE/);
assert.match(controller, /TAX_ISSUER_PROFILE_BRANCH_FORBIDDEN/);
assert.doesNotMatch(controller, /OWNER.*MANAGER|MANAGER.*OWNER/);
assert.match(service, /TAX_ISSUER_PROFILE_ACTIVATION_INCOMPLETE/);
assert.match(service, /exactly 13 digits/);
assert.match(service, /TAX_ISSUER_PROFILE_FIELD_FORBIDDEN/);
assert.match(service, /EDITABLE_FIELDS/);
assert.match(service, /creditNotePrefix/);
assert.ok(repository.includes("require('../../../../lib/prisma')"));
assert.ok(repository.includes('taxIssuerProfile.upsert'));
assert.match(taxRoutes, /issuer-profile/);

console.log('Tax issuer profile runtime contract: PASS');
