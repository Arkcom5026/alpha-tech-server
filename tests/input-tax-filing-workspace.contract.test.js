'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const routes = read('src/modules/tax/inputDocuments/filing/inputTaxFilingRoutes.js');
const controller = read('src/modules/tax/inputDocuments/filing/inputTaxFilingController.js');
const workspaceService = read('src/modules/tax/inputDocuments/filing/inputTaxFilingWorkspaceService.js');
const workspaceRepository = read('src/modules/tax/inputDocuments/filing/inputTaxFilingWorkspaceRepository.js');

test('exposes period-scoped filing workspace and replay-safe preparation', () => {
  assert.match(routes, /periods\/:taxPeriodId\/workspace/);
  assert.match(routes, /periods\/:taxPeriodId\/prepare/);
  assert.match(controller, /InputTaxCapability\.VIEW/);
  assert.match(controller, /InputTaxCapability\.SELECT_FOR_FILING/);
  assert.match(workspaceService, /prepareInputTaxFilingBatch/);
  assert.match(workspaceRepository, /pg_advisory_xact_lock/);
  assert.match(workspaceRepository, /'DRAFT'::"InputTaxFilingStatus"/);
  assert.match(workspaceService, /replayed: true/);
});

test('workspace is driven by authoritative VAT, reconciliation and eligibility projections', () => {
  assert.match(workspaceRepository, /FROM "InputVatRecord" record/);
  assert.match(workspaceService, /overviewRepository\.listDocumentProjection/);
  assert.match(workspaceService, /overviewService\.projectDocumentReconciliation/);
  assert.match(workspaceService, /projectInputTaxEligibility/);
  assert.match(workspaceService, /projectInputTaxDuplicates/);
  assert.match(workspaceService, /projectInputTaxReplacementChains/);
  assert.match(workspaceService, /canSelectForFiling/);
});

test('workspace surfaces active input tax documents before Input VAT authority exists', () => {
  assert.match(workspaceService, /INPUT_TAX_PENDING_AUTHORITY_STATUSES/);
  assert.match(workspaceService, /INPUT_TAX_VISIBLE_STATUSES/);
  assert.match(workspaceService, /requiresInputVatApproval/);
  assert.match(workspaceService, /nextLifecycleTarget/);
  assert.match(workspaceService, /canAdvanceLifecycle/);
  assert.match(workspaceService, /pendingApprovalCount/);
  assert.match(workspaceService, /pendingApprovalCount === 0 && coversAllDocuments/);
});

test('selection mutation reuses full-context duplicate replacement and eligibility authority', () => {
  assert.match(controller, /projectInputTaxDuplicates\(rows\)\.get\(row\.id\)/);
  assert.match(controller, /projectInputTaxReplacementChains\(rows\)\.get\(row\.id\)/);
  assert.match(controller, /projectInputTaxEligibility\(\{/);
  assert.doesNotMatch(controller, /documents: \[row\]/);
});

test('preparing a closing batch does not mark it as filed or government-submitted', () => {
  assert.doesNotMatch(workspaceService, /markInputTaxBatchFiled/);
  assert.doesNotMatch(workspaceService, /submitBatch/);
  assert.match(workspaceService, /readyForTaxClosing/);
  assert.match(workspaceService, /filingCoversAllDocuments/);
});
