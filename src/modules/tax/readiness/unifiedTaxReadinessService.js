'use strict';

const { prisma, Prisma } = require('../../../../lib/prisma');
const accountingOfficeService = require('../accountingOffice/accountingOfficePackageService');
const withholdingTaxService = require('../withholdingTax/withholdingTaxService');
const { normalizeWithholdingTaxWorkspace } = require('../withholdingTax/withholdingTaxReadiness');
const vatSettlementService = require('../settlement/vatSettlementService');

const LEGACY_WHT_CODES = new Set([
  'WITHHOLDING_NOT_COMPLETED',
  'WITHHOLDING_CERTIFICATE_MISSING',
]);

const LEGACY_EXPENSE_CODES = new Set([
  'TAX_EXPENSE_ASSESSMENT_PENDING',
]);

const SETTLEMENT_DUPLICATES = new Set([
  'VAT_SETTLEMENT_OUTPUT_FILING_NOT_PREPARED',
  'VAT_SETTLEMENT_INPUT_FILING_NOT_PREPARED',
  'VAT_SETTLEMENT_PERIOD_NOT_LOCKED',
]);

const INPUT_VAT_WORKSPACE_CODES = new Set([
  'INPUT_VAT_DOCUMENT_APPROVAL_REQUIRED',
  'INPUT_VAT_FILING_NOT_PREPARED',
  'INPUT_VAT_FILING_INCOMPLETE',
]);

const INPUT_VAT_FILING_CODES = new Set([
  'INPUT_VAT_FILING_NOT_PREPARED',
  'INPUT_VAT_FILING_INCOMPLETE',
]);

const routeFor = (exception, taxPeriodId) => {
  const code = String(exception?.code || '');
  const source = String(exception?.source || '');
  if (source === 'TAX_EXPENSE' && Number.isInteger(Number(exception?.taxExpenseId)) && Number(exception.taxExpenseId) > 0) {
    return `tax-expenses?assessmentExpenseId=${Number(exception.taxExpenseId)}`;
  }
  if (INPUT_VAT_WORKSPACE_CODES.has(code)) {
    return `tax-periods/${taxPeriodId}/input-vat-filing`;
  }
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
  sourceRefs: Object.freeze(Array.isArray(entry?.sourceRefs) ? entry.sourceRefs.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0) : []),
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

const loadPendingVatCitExpenses = async ({ branchId, period }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT pending."id", COUNT(*) OVER()::int AS "totalCount"
    FROM (
      SELECT DISTINCT expense."id"
      FROM "TaxExpense" expense
      JOIN "TaxExpenseItem" item
        ON item."taxExpenseId" = expense."id"
       AND item."branchId" = expense."branchId"
      WHERE expense."branchId" = ${Number(branchId)}
        AND expense."expenseDate" >= ${period.startDate}
        AND expense."expenseDate" <= ${period.endDate}
        AND expense."status" <> 'VOIDED'::"TaxExpenseStatus"
        AND (
          item."vatTreatment" = 'PENDING_REVIEW'::"TaxExpenseVatTreatment"
          OR item."citTreatment" = 'PENDING_REVIEW'::"TaxExpenseCitTreatment"
        )
    ) pending
    ORDER BY pending."id" ASC
    LIMIT 20
  `);
  return Object.freeze({
    count: Number(rows[0]?.totalCount || 0),
    expenseIds: Object.freeze(rows.map((row) => Number(row.id)).filter((value) => Number.isInteger(value) && value > 0)),
  });
};

const loadPendingInputVatApproval = async ({ branchId, period }, tx = prisma) => {
  const rows = await tx.$queryRaw(Prisma.sql`
    SELECT pending."id", COUNT(*) OVER()::int AS "totalCount"
    FROM (
      SELECT document."id"
      FROM "TaxDocument" document
      LEFT JOIN "InputVatRecord" record
        ON record."taxDocumentId" = document."id"
       AND record."branchId" = document."branchId"
      WHERE document."branchId" = ${Number(branchId)}
        AND document."documentType" = 'INPUT_TAX_INVOICE'
        AND COALESCE(document."issuedAt", document."occurredAt") >= ${period.startDate}
        AND COALESCE(document."issuedAt", document."occurredAt") <= ${period.endDate}
        AND document."status" IN ('DRAFT', 'REGISTERED', 'UNDER_REVIEW', 'APPROVED')
        AND record."id" IS NULL
    ) pending
    ORDER BY pending."id" ASC
    LIMIT 20
  `);
  return Object.freeze({
    count: Number(rows[0]?.totalCount || 0),
    taxDocumentIds: Object.freeze(rows.map((row) => Number(row.id)).filter((value) => Number.isInteger(value) && value > 0)),
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
  const [pendingVatCit, pendingInputVatApproval] = await Promise.all([
    loadPendingVatCitExpenses({ branchId, period: closingPackage.period }),
    loadPendingInputVatApproval({ branchId, period: closingPackage.period }),
  ]);

  const closingExceptions = (closingPackage.exceptions || [])
    .filter((entry) => !LEGACY_WHT_CODES.has(entry.code) && !LEGACY_EXPENSE_CODES.has(entry.code))
    .filter((entry) => !(pendingInputVatApproval.count > 0 && INPUT_VAT_FILING_CODES.has(entry.code)))
    .map((entry) => normalizeException(entry, taxPeriodId, 'MONTHLY_TAX_CLOSING_PACKAGE'));
  const inputVatApprovalExceptions = pendingInputVatApproval.count > 0
    ? [normalizeException({
        code: 'INPUT_VAT_DOCUMENT_APPROVAL_REQUIRED',
        source: 'INPUT_VAT',
        severity: 'BLOCKER',
        count: pendingInputVatApproval.count,
        sourceRefs: pendingInputVatApproval.taxDocumentIds,
        message: 'Input tax invoices remain pending approval into Input VAT authority',
      }, taxPeriodId, 'INPUT_VAT_DOCUMENT_LIFECYCLE')]
    : [];
  const expenseExceptions = pendingVatCit.count > 0
    ? [normalizeException({
        code: 'TAX_EXPENSE_VAT_CIT_ASSESSMENT_PENDING',
        source: 'TAX_EXPENSE',
        severity: 'BLOCKER',
        count: pendingVatCit.count,
        taxExpenseId: pendingVatCit.expenseIds[0] || null,
        sourceRefs: pendingVatCit.expenseIds,
        message: 'Tax expenses remain pending VAT/CIT assessment',
      }, taxPeriodId, 'TAX_EXPENSE_ASSESSMENT')]
    : [];
  const whtExceptions = (withholding.exceptions || [])
    .map((entry) => normalizeException(entry, taxPeriodId, 'WITHHOLDING_TAX_WORKSPACE'));
  const settlementExceptions = (vatSettlement.exceptions || [])
    .filter((entry) => !SETTLEMENT_DUPLICATES.has(entry.code))
    .map((entry) => normalizeException(entry, taxPeriodId, 'VAT_SETTLEMENT_PREPARATION'));
  const exceptions = Object.freeze(dedupeExceptions([
    ...closingExceptions,
    ...inputVatApprovalExceptions,
    ...expenseExceptions,
    ...whtExceptions,
    ...settlementExceptions,
  ]));

  const expensesReady = pendingVatCit.count === 0
    && closingPackage.readiness?.expenseEvidenceComplete === true;
  const documentsReady = closingPackage.readiness?.outputVatComplete === true
    && closingPackage.readiness?.inputVatComplete === true
    && pendingInputVatApproval.count === 0
    && closingPackage.readiness?.expenseEvidenceComplete === true;
  const inputVatReady = closingPackage.readiness?.inputVatReady === true
    && pendingInputVatApproval.count === 0;
  const reconciliationReady = vatSettlement.readiness?.outputFilingReconciled === true
    && vatSettlement.readiness?.inputCreditAuthorityReady === true;
  const inputVatTarget = exceptions.find((entry) => entry.source === 'INPUT_VAT')?.target?.relativePath
    || `tax-periods/${taxPeriodId}/input-vat-filing`;
  const domains = Object.freeze([
    Object.freeze({ key: 'OUTPUT_VAT', label: 'Output VAT', ready: closingPackage.readiness?.outputVatReady === true, target: 'output-tax-filings' }),
    Object.freeze({ key: 'INPUT_VAT', label: 'Input VAT', ready: inputVatReady, target: inputVatTarget }),
    Object.freeze({ key: 'TAX_EXPENSE', label: 'Expenses', ready: expensesReady, target: 'tax-expenses' }),
    Object.freeze({ key: 'WITHHOLDING_TAX', label: 'WHT', ready: withholding.readiness?.readyForAccountant === true, target: `tax-periods/${taxPeriodId}/withholding-tax` }),
    Object.freeze({ key: 'DOCUMENTS', label: 'Documents', ready: documentsReady, target: `tax-periods/${taxPeriodId}/accounting-office` }),
    Object.freeze({ key: 'RECONCILIATION', label: 'Reconciliation', ready: reconciliationReady, target: `tax-periods/${taxPeriodId}/vat-settlement` }),
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
  loadPendingInputVatApproval,
  loadUnifiedTaxReadiness,
  loadPendingVatCitExpenses,
  normalizeException,
  routeFor,
});
