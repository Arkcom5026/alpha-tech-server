'use strict';

const accountingOfficeService = require('../accountingOffice/accountingOfficePackageService');
const withholdingTaxService = require('../withholdingTax/withholdingTaxService');
const { normalizeWithholdingTaxWorkspace } = require('../withholdingTax/withholdingTaxReadiness');
const vatSettlementService = require('../settlement/vatSettlementService');

const LEGACY_WHT_CODES = new Set([
  'WITHHOLDING_NOT_COMPLETED',
  'WITHHOLDING_CERTIFICATE_MISSING',
]);

const SETTLEMENT_DUPLICATES = new Set([
  'VAT_SETTLEMENT_OUTPUT_FILING_NOT_PREPARED',
  'VAT_SETTLEMENT_INPUT_FILING_NOT_PREPARED',
  'VAT_SETTLEMENT_PERIOD_NOT_LOCKED',
]);

const routeFor = (exception, taxPeriodId) => {
  const code = String(exception?.code || '');
  const source = String(exception?.source || '');
  if (code.startsWith('VAT_SETTLEMENT_') || ['PRIOR_PERIOD_VAT_CREDIT', 'HISTORICAL_OPENING_VAT_CREDIT'].includes(source)) {
    return `tax-periods/${taxPeriodId}/vat-settlement`;
  }
  if (code.startsWith('WHT_') || source.startsWith('WHT_') || source === 'WITHHOLDING_TAX') {
    return `tax-periods/${taxPeriodId}/withholding-tax`;
  }
  if (source === 'TAX_EXPENSE' || code.startsWith('TAX_EXPENSE_')) return 'tax-expenses';
  if (source === 'INPUT_VAT' || code.startsWith('INPUT_VAT_')) return 'input-tax-receipts';
  if (source === 'OUTPUT_VAT' || code.startsWith('OUTPUT_VAT_')) return 'output-tax-filings';
  if (source === 'TAX_PERIOD' || code.startsWith('TAX_PERIOD_')) return 'tax-periods';
  return `tax-periods/${taxPeriodId}/accounting-office`;
};

const normalizeException = (entry, taxPeriodId, origin) => Object.freeze({
  code: String(entry?.code || 'UNKNOWN_TAX_EXCEPTION'),
  source: String(entry?.source || 'TAX'),
  severity: entry?.severity === 'BLOCKING' ? 'BLOCKER' : String(entry?.severity || 'BLOCKER'),
  count: Number(entry?.count || 1),
  message: entry?.message || null,
  amount: entry?.amount == null ? null : Number(entry.amount),
  origin,
  target: Object.freeze({
    kind: 'FINANCE_ROUTE',
    relativePath: routeFor(entry, taxPeriodId),
  }),
});

const dedupeExceptions = (entries) => {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.code}:${entry.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const loadUnifiedTaxReadiness = async ({ branchId, taxPeriodId }) => {
  const args = { branchId, taxPeriodId };
  const [closingPackage, withholdingRaw, vatSettlement] = await Promise.all([
    accountingOfficeService.loadAccountingOfficePackage(args),
    withholdingTaxService.loadWithholdingTaxWorkspace(args),
    vatSettlementService.loadVatSettlementPreparation(args),
  ]);
  const withholding = normalizeWithholdingTaxWorkspace(withholdingRaw);

  const closingExceptions = (closingPackage.exceptions || [])
    .filter((entry) => !LEGACY_WHT_CODES.has(entry.code))
    .map((entry) => normalizeException(entry, taxPeriodId, 'MONTHLY_TAX_CLOSING_PACKAGE'));
  const whtExceptions = (withholding.exceptions || [])
    .map((entry) => normalizeException(entry, taxPeriodId, 'WITHHOLDING_TAX_WORKSPACE'));
  const settlementExceptions = (vatSettlement.exceptions || [])
    .filter((entry) => !SETTLEMENT_DUPLICATES.has(entry.code))
    .map((entry) => normalizeException(entry, taxPeriodId, 'VAT_SETTLEMENT_PREPARATION'));
  const exceptions = Object.freeze(dedupeExceptions([
    ...closingExceptions,
    ...whtExceptions,
    ...settlementExceptions,
  ]));

  const domains = Object.freeze([
    Object.freeze({ key: 'OUTPUT_VAT', label: 'Output VAT', ready: closingPackage.readiness?.outputVatReady === true, target: 'output-tax-filings' }),
    Object.freeze({ key: 'INPUT_VAT', label: 'Input VAT', ready: closingPackage.readiness?.inputVatReady === true, target: 'input-tax-receipts' }),
    Object.freeze({ key: 'TAX_EXPENSE', label: 'Expenses', ready: closingPackage.readiness?.expensesReady === true, target: 'tax-expenses' }),
    Object.freeze({ key: 'WITHHOLDING_TAX', label: 'WHT', ready: withholding.readiness?.readyForAccountant === true, target: `tax-periods/${taxPeriodId}/withholding-tax` }),
    Object.freeze({ key: 'PP30', label: 'PP30', ready: vatSettlement.readiness?.readyForPp30Preparation === true, target: `tax-periods/${taxPeriodId}/vat-settlement` }),
    Object.freeze({ key: 'TAX_PERIOD', label: 'Tax Period', ready: closingPackage.readiness?.periodLockedOrSubmitted === true, target: 'tax-periods' }),
  ]);
  const readyCount = domains.filter((entry) => entry.ready).length;
  const blockerCount = exceptions.filter((entry) => entry.severity === 'BLOCKER').reduce((sum, entry) => sum + entry.count, 0);
  const reviewCount = exceptions.filter((entry) => entry.severity === 'REVIEW').reduce((sum, entry) => sum + entry.count, 0);

  return Object.freeze({
    authority: 'UNIFIED_TAX_READINESS',
    branchId: Number(branchId),
    period: closingPackage.period,
    summary: Object.freeze({
      domainCount: domains.length,
      readyDomainCount: readyCount,
      readinessPercent: Math.round((readyCount / domains.length) * 100),
      blockerCount,
      reviewCount,
      readyForAccountant: blockerCount === 0 && readyCount === domains.length,
    }),
    domains,
    exceptions,
  });
};

module.exports = Object.freeze({
  loadUnifiedTaxReadiness,
  normalizeException,
  routeFor,
});
