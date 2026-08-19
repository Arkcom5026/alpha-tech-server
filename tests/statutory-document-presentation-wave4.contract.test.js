'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const service = read('src/modules/tax/documents/presentation/statutoryTaxPresentationService.js');
const controller = read('src/modules/tax/documents/presentation/getStatutoryTaxPresentationController.js');
const routes = read('src/modules/tax/http/taxIntakeRoutes.js');
const creditNote = read('src/modules/tax/documents/creditNote/print/projectOutputTaxCreditNotePrintableDocumentService.js');
const capability = read('src/modules/document-presentation/presentationCapabilityRegistry.js');

assert.match(capability, /FULL_TAX_INVOICE:\s*STATUTORY_A4/);
assert.match(capability, /CREDIT_NOTE:\s*STATUTORY_A4/);
assert.match(capability, /SHORT_TAX_INVOICE:\s*STATUTORY_THERMAL/);
assert.match(capability, /protectedBlocks:\s*\['DOCUMENT_META', 'PARTY', 'ITEM_TABLE', 'TOTALS', 'SYSTEM_NOTICE'\]/);

assert.match(service, /sourceType:\s*'TAX_DOCUMENT'/);
assert.match(service, /documentPurpose,/);
assert.match(service, /rendererFamily:\s*documentPurpose === 'SHORT_TAX_INVOICE' \? 'THERMAL_80MM' : 'A4'/);
assert.match(service, /issuerSnapshot:\s*taxDocument\.issuerSnapshot/);
assert.match(service, /recipientSnapshot:\s*taxDocument\.recipientSnapshot \|\| null/);
assert.match(service, /status !== 'REGISTERED'/);
assert.match(service, /documentHeaderConfig:\s*true/);

assert.match(routes, /router\.get\('\/documents\/:taxDocumentId\/presentation', getStatutoryTaxPresentation\)/);
assert.match(controller, /authenticatedBranchId = positiveInt\(req\.user\?\.branchId\)/);
assert.match(controller, /requestedBranchId && requestedBranchId !== authenticatedBranchId/);
assert.match(controller, /status\(403\).*TAX_BRANCH_FORBIDDEN/);
assert.match(controller, /where:\s*\{ id: taxDocumentId, branchId: authenticatedBranchId \}/);
assert.match(controller, /issuerSnapshot:\s*true/);
assert.match(controller, /recipientSnapshot:\s*true/);
assert.match(controller, /ensureStatutoryTaxPresentationSnapshot/);
assert.match(controller, /presentationSnapshot:\s*record\.snapshot/);

assert.match(creditNote, /ensureStatutoryTaxPresentationSnapshot/);
assert.match(creditNote, /presentationSnapshot:\s*presentationRecord\.snapshot/);
assert.match(creditNote, /issuer:\s*document\.issuerSnapshot/);
assert.match(creditNote, /recipient:\s*document\.recipientSnapshot \|\| null/);

console.log('statutory-document-presentation-wave4.contract.test.js: PASS');
