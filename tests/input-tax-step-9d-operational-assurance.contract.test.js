'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const policy = read('src/modules/tax/policies/inputTaxOperationalAssurancePolicy.js');
const inputVatService = read('src/modules/tax/inputVat/inputVatRecordService.js');
const lifecycleRepository = read('src/modules/tax/documents/repository/taxDocumentRepository.js');
const reportController = read('src/modules/reporting/tax/input/runtime/inputTaxReportRuntimeController.js');

assert.match(policy, /AUTHORITY_IMMUTABLE/);
assert.match(policy, /AUDIT_APPEND_ONLY/);
assert.match(policy, /MUTATION_REPLAY_SAFE/);
assert.match(policy, /CONFLICT_REQUIRES_REFRESH/);
assert.match(policy, /DO_NOT_BLIND_RETRY/);
assert.match(policy, /InputVatRecord/);
assert.match(policy, /TaxDocumentLifecycleEvent/);
assert.match(policy, /INPUT_TAX_FILING_SUBMIT/);
assert.match(policy, /INPUT_TAX_PERIOD_TRANSITION/);

assert.match(inputVatService, /replayKeyFor/);
assert.match(inputVatService, /inputVatRecord\.create/);
assert.doesNotMatch(inputVatService, /inputVatRecord\.delete/);
assert.doesNotMatch(inputVatService, /inputVatRecord\.deleteMany/);
assert.doesNotMatch(inputVatService, /inputVatRecord\.update/);
assert.doesNotMatch(inputVatService, /inputVatRecord\.updateMany/);

assert.match(lifecycleRepository, /INSERT INTO "TaxDocumentLifecycleEvent"/);
assert.doesNotMatch(lifecycleRepository, /DELETE FROM "TaxDocumentLifecycleEvent"/);
assert.doesNotMatch(lifecycleRepository, /UPDATE "TaxDocumentLifecycleEvent"/);

assert.match(reportController, /safeLogContext/);
assert.match(reportController, /INPUT_TAX_REPORT_INTERNAL_ERROR/);
assert.doesNotMatch(reportController, /error:\s*error\.message/);
assert.doesNotMatch(reportController, /console\.error\([^\n]*,\s*error\)/);
assert.doesNotMatch(reportController, /req\.body/);

console.log('input tax step 9d operational assurance contract: PASS');
