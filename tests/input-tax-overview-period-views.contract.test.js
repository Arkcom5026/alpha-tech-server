'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('INPUT_TAX_OVERVIEW_V1 period views contract', () => {
  const root = path.resolve(__dirname, '..');
  const contractPath = path.join(root, 'src/modules/tax/inputDocuments/overview/inputTaxOverviewContract.js');
  const repositoryPath = path.join(root, 'src/modules/tax/inputDocuments/overview/inputTaxOverviewRepository.js');
  const servicePath = path.join(root, 'src/modules/tax/inputDocuments/overview/inputTaxOverviewService.js');

  it('declares all supported period views', () => {
    const contract = fs.readFileSync(contractPath, 'utf8');
    ['DOCUMENT', 'RECEIVED', 'CLAIM', 'FILED'].forEach((value) => assert.match(contract, new RegExp(`'${value}'`)));
  });

  it('uses period-specific timestamp authority', () => {
    const repository = fs.readFileSync(repositoryPath, 'utf8');
    assert.match(repository, /inputTaxReceivedAt/);
    assert.match(repository, /inputTaxClaimedAt/);
    assert.match(repository, /inputTaxSelectedAt/);
    assert.match(repository, /inputTaxFiledAt/);
    assert.match(repository, /inputTaxSubmittedAt/);
    assert.match(repository, /periodDate/);
  });

  it('passes periodView to current and previous projections', () => {
    const service = fs.readFileSync(servicePath, 'utf8');
    assert.doesNotMatch(service, /PERIOD_VIEW_NOT_IMPLEMENTED/);
    assert.match(service, /listDocumentProjection\(\{ branchId, periodView, periodFrom: periodFromDate/);
    assert.match(service, /listDocumentProjection\(\{ branchId, periodView, periodFrom: previousFrom/);
    assert.match(service, /periodView,\n      periodDate: row\.periodDate/);
  });
});
