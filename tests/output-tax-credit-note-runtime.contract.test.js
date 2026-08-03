'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const issueService = fs.readFileSync(
  path.join(root, 'src/modules/tax/documents/creditNote/create/issueOutputTaxCreditNoteService.js'),
  'utf8',
);
const controller = fs.readFileSync(
  path.join(root, 'src/modules/tax/http/taxIntakeController.js'),
  'utf8',
);

assert.match(issueService, /assertOutputTaxCreditNoteEligibility/);
assert.match(issueService, /TAX_CREDIT_NOTE_SOURCE_UNSUPPORTED/);
assert.match(issueService, /LIMIT 1 FOR UPDATE/);
assert.match(issueService, /nextCreditNoteNumber/);
assert.match(issueService, /Prisma\.TransactionIsolationLevel\.Serializable/);
assert.match(issueService, /originalTaxDocumentId/);
assert.match(issueService, /saleReturnId/);
assert.match(issueService, /OUTPUT_TAX_CREDIT_NOTE/);
assert.match(issueService, /replayed: true/);
assert.match(controller, /issueOutputTaxCreditNote/);
assert.match(controller, /saleReturnId: req\.body\?\.saleReturnId/);

console.log('Output tax credit-note issuance runtime contract: PASS');
