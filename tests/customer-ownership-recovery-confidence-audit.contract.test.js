const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const scriptPath = path.join(
  root,
  'scripts/audit-customer-ownership-recovery-confidence.js'
);
const source = fs.readFileSync(scriptPath, 'utf8');

assert.match(source, /CUSTOMER_OWNERSHIP_RECOVERY_CONFIDENCE_READ_ONLY_AUDIT/);
assert.match(source, /mutationPerformed:\s*false/);
assert.match(source, /AUTO_CONFIRM/);
assert.match(source, /REVIEW_REQUIRED/);
assert.match(source, /NO_RECOVERABLE_EVIDENCE/);
assert.match(source, /CONFLICT/);
assert.match(source, /creatorRowCount\s*>=\s*2/);
assert.match(source, /creatorBranches\.length\s*===\s*1/);
assert.match(source, /creatorDirectConflicts\.length\s*===\s*0/);
assert.match(source, /DIRECT_SINGLE_BRANCH_BUSINESS_EVIDENCE/);
assert.match(source, /CREATOR_BRANCH_CORROBORATED_ACROSS_MULTIPLE_SOURCES/);
assert.doesNotMatch(source, /\bUPDATE\s+"CustomerProfile"/i);
assert.doesNotMatch(source, /\bINSERT\s+INTO\s+"CustomerProfile"/i);
assert.doesNotMatch(source, /\bDELETE\s+FROM\s+"CustomerProfile"/i);

console.log('customer-ownership-recovery-confidence-audit.contract: PASS');
