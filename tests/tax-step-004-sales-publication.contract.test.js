'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const publicationService = read('src/modules/sales/completion/services/publishSaleTaxCandidateService.js');
const completionController = read('src/modules/sales/completion/controllers/saleCompletionController.js');
const taxEntry = read('src/modules/tax/index.js');
const stepContract = read('docs/tax/TAX_INCREMENT_A_STEP_CONTRACT.md');

assert.match(publicationService, /require\('\.\.\/\.\.\/\.\.\/tax'\)/, 'Sales must depend on the Tax public capability boundary');
assert.match(publicationService, /registerSaleCandidate/, 'Sales publication must call the SALE tax source adapter');
assert.match(publicationService, /PENDING_RETRY/, 'Tax publication failure must not roll back an already committed sale');
assert.match(publicationService, /READY_SALE_STATUSES/, 'Publication must be gated by immutable ready-sale status');
assert.match(completionController, /publishSaleTaxCandidate/, 'Sale completion controller must publish the committed sale reference');
assert.match(completionController, /taxIntake/, 'Sale completion result must expose publication evidence');
assert.match(taxEntry, /registerSaleCandidate/, 'Tax public entry must expose the SALE source capability');
assert.match(stepContract, /Source modules remain decoupled from Tax persistence/, 'STEP 004 ownership rule must remain explicit');

console.log('Tax STEP 004 sales publication contract: PASS');
