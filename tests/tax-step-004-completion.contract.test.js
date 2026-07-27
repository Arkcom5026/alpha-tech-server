'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const stepContract = read('docs/tax/TAX_INCREMENT_A_STEP_CONTRACT.md');
const completionRecord = read('docs/tax/TAX_STEP_004_COMPLETION.md');
const migration = read('prisma/migrations/20260727233000_add_tax_intake_foundation/migration.sql');
const registrationService = read('src/modules/tax/intake/registerTaxCandidateService.js');
const publicationService = read('src/modules/sales/completion/services/publishSaleTaxCandidateService.js');
const completionController = read('src/modules/sales/completion/controllers/saleCompletionController.js');

assert.match(stepContract, /idempotent by branch \+ source type \+ source identity/, 'STEP 004 must preserve source identity');
assert.match(migration, /UNIQUE INDEX "TaxCandidate_branchId_sourceType_sourceId_key"/, 'Database must enforce candidate source identity');
assert.match(migration, /UNIQUE INDEX "TaxDocument_candidateId_key"/, 'Database must enforce one Tax Document per candidate');
assert.match(registrationService, /prisma\.\$transaction/, 'Candidate mapping must remain Tax-transaction owned');
assert.match(registrationService, /replayed:\s*true/, 'Idempotent replay must be explicit');
assert.match(registrationService, /findByCandidateId/, 'Replay must return the linked Tax Document');
assert.match(publicationService, /require\('\.\.\/\.\.\/\.\.\/tax'\)/, 'Sales must use the Tax public boundary');
assert.match(publicationService, /PENDING_RETRY/, 'Committed Sales must survive Tax publication failure');
assert.match(completionController, /publishSaleTaxCandidate/, 'Sale completion must publish the immutable Sale reference');
assert.match(completionRecord, /STEP 004 is \*\*Repository COMPLETE\*\*/, 'Completion decision must be recorded');
assert.match(completionRecord, /Runtime Gate: PENDING LOCAL EXECUTION/, 'Repository completion must not claim local certification');

console.log('Tax STEP 004 repository completion contract: PASS');
