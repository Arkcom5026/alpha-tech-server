'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relativePath) =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

const repositorySource = read(
  'src/modules/productTemplate/candidates/discovery/auditProductTemplateDiscoveryRepository.js'
);
const serviceSource = read(
  'src/modules/productTemplate/candidates/discovery/auditProductTemplateDiscoveryService.js'
);

assert.match(
  serviceSource,
  /\[BusinessType\.IT\]:\s*DEFAULT_TEMPLATE_BRANCH_CODE/,
  'IT discovery must map to the canonical Product Template branch code authority'
);
assert.match(
  serviceSource,
  /findTemplateBranchByCode\(\{[\s\S]*branchCode:\s*templateBranchCode/,
  'discovery must resolve the Template Branch by branch code'
);
assert.doesNotMatch(
  serviceSource,
  /findTemplateBranchByBusinessType/,
  'discovery must not resolve Template Branch ownership from Branch.businessType'
);
assert.match(
  repositorySource,
  /const findTemplateBranchByCode = \(\{ branchCode \}\)/,
  'repository must expose a branch-code Template resolver'
);
assert.doesNotMatch(
  repositorySource,
  /where:\s*\{[\s\S]{0,120}businessType/,
  'Template Branch query must not filter by businessType'
);
assert.match(
  repositorySource,
  /where:\s*\{\s*branchCode,\s*\}/,
  'Template Branch query must use branchCode as authority'
);
assert.match(
  serviceSource,
  /categoryId:\s*templateBranch\.categoryId/,
  'resolved Template Branch categoryId must remain the Store scope boundary'
);

console.log('product-template-branch-code-authority-fix.contract.test.js: PASS');
