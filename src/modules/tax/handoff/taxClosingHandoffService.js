'use strict';

const crypto = require('node:crypto');
const accountingOfficeService = require('../accountingOffice/accountingOfficePackageService');
const accountingOfficeController = require('../accountingOffice/accountingOfficePackageController');
const withholdingTaxService = require('../withholdingTax/withholdingTaxService');
const unifiedTaxReadinessService = require('../readiness/unifiedTaxReadinessService');

const normalizeForHash = (value) => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeForHash(value[key])]),
    );
  }
  return value;
};

const stableJson = (value) => JSON.stringify(normalizeForHash(value));
const sha256 = (value) => crypto.createHash('sha256').update(stableJson(value)).digest('hex');

const buildManifest = ({ periodCode, packageStatus, sourceSnapshot }) => Object.freeze({
  schemaVersion: 1,
  packageStatus,
  intendedUse: 'TAX_CLOSING_HANDOFF',
  governmentFilingAuthority: false,
  files: Object.freeze([
    Object.freeze({ key: 'MANIFEST', filename: `tax-closing-${periodCode}-manifest.json`, mediaType: 'application/json' }),
    Object.freeze({ key: 'BUNDLE', filename: `tax-closing-${periodCode}-bundle.json`, mediaType: 'application/json' }),
    Object.freeze({ key: 'OUTPUT_VAT', filename: `output-vat-${periodCode}.csv`, mediaType: 'text/csv' }),
    Object.freeze({ key: 'INPUT_VAT', filename: `input-vat-${periodCode}.csv`, mediaType: 'text/csv' }),
    Object.freeze({ key: 'TAX_EXPENSES', filename: `tax-expenses-${periodCode}.csv`, mediaType: 'text/csv' }),
    Object.freeze({ key: 'WITHHOLDING_TAX', filename: `withholding-tax-${periodCode}.csv`, mediaType: 'text/csv' }),
  ]),
  counts: Object.freeze({
    outputVatDocuments: sourceSnapshot.outputVat.documents.length,
    inputVatDocuments: sourceSnapshot.inputVat.documents.length,
    taxExpenses: sourceSnapshot.expenses.rows.length,
    withholdingRows: sourceSnapshot.withholding.rows.length,
    blockers: Number(sourceSnapshot.readiness.summary.blockerCount || 0),
  }),
});

const loadTaxClosingHandoffBundle = async ({ branchId, taxPeriodId }) => {
  const args = { branchId, taxPeriodId };
  const [rawClosingPackage, withholdingWorkspace, readiness] = await Promise.all([
    accountingOfficeService.loadAccountingOfficePackage(args),
    withholdingTaxService.loadWithholdingTaxWorkspace(args),
    unifiedTaxReadinessService.loadUnifiedTaxReadiness(args),
  ]);
  const closingPackage = accountingOfficeController.composeWithholdingAuthority(rawClosingPackage, withholdingWorkspace);
  const packageStatus = readiness.summary?.readyForAccountant === true
    ? 'READY_FOR_HANDOFF'
    : 'DRAFT_REQUIRES_ACTION';

  const sourceSnapshot = Object.freeze({
    authority: 'TAX_CLOSING_HANDOFF_SNAPSHOT',
    branchId: Number(branchId),
    period: closingPackage.period,
    readiness: Object.freeze({
      summary: readiness.summary,
      domains: readiness.domains,
      exceptions: readiness.exceptions,
    }),
    outputVat: Object.freeze({
      summary: closingPackage.summary,
      filing: closingPackage.filing,
      documents: closingPackage.documents || [],
    }),
    inputVat: Object.freeze({
      summary: closingPackage.inputSummary,
      filing: closingPackage.inputFiling,
      documents: closingPackage.inputDocuments || [],
    }),
    expenses: Object.freeze({
      summary: closingPackage.expenseSummary,
      rows: closingPackage.expenses || [],
    }),
    withholding: Object.freeze({
      summary: closingPackage.withholdingSummary || null,
      filings: closingPackage.withholdingFilings || [],
      rows: closingPackage.withholdingRows || [],
    }),
  });

  const periodCode = String(closingPackage.period?.periodCode || taxPeriodId);
  const manifest = buildManifest({ periodCode, packageStatus, sourceSnapshot });
  const snapshotHash = sha256(sourceSnapshot);

  return Object.freeze({
    authority: 'TAX_CLOSING_HANDOFF_PACKAGE',
    packageVersion: 1,
    packageStatus,
    snapshotHash,
    generatedAt: new Date().toISOString(),
    branchId: Number(branchId),
    taxPeriodId: String(taxPeriodId),
    periodCode,
    handoffReady: packageStatus === 'READY_FOR_HANDOFF',
    manifest,
    snapshot: sourceSnapshot,
  });
};

module.exports = Object.freeze({
  loadTaxClosingHandoffBundle,
  buildManifest,
  normalizeForHash,
  sha256,
});
