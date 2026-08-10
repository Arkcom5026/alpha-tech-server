'use strict';

const service = require('./accountingOfficePackageService');
const withholdingTaxService = require('../withholdingTax/withholdingTaxService');
const { normalizeWithholdingTaxWorkspace } = require('../withholdingTax/withholdingTaxReadiness');

const normalizeRole = (value) => String(value || '').trim().toUpperCase();

const requireBranchAuthority = (req) => {
  const requestedBranchId = Number(req.query?.branchId);
  const authorityBranchId = Number(req.user?.branchId || req.user?.employeeBranchId || req.user?.currentBranchId || 0);
  const accountRole = normalizeRole(req.user?.role);
  const employeeRole = normalizeRole(req.user?.employeeRole || req.user?.position);

  if (!Number.isInteger(requestedBranchId) || requestedBranchId <= 0) {
    const error = new Error('branchId must be a positive integer');
    error.code = 'ACCOUNTING_OFFICE_BRANCH_REQUIRED';
    error.statusCode = 400;
    throw error;
  }

  const elevated = ['SUPERADMIN', 'ADMIN'].includes(accountRole) || ['OWNER', 'MANAGER'].includes(employeeRole);
  if (!elevated) {
    const error = new Error('Accounting office package requires administrative authority');
    error.code = 'ACCOUNTING_OFFICE_ACCESS_FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }
  if (!['SUPERADMIN', 'ADMIN'].includes(accountRole) && authorityBranchId > 0 && authorityBranchId !== requestedBranchId) {
    const error = new Error('Cannot access another branch accounting office package');
    error.code = 'ACCOUNTING_OFFICE_BRANCH_FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }
  return requestedBranchId;
};

const LEGACY_WHT_EXCEPTION_CODES = new Set([
  'WITHHOLDING_NOT_COMPLETED',
  'WITHHOLDING_CERTIFICATE_MISSING',
]);

const composeWithholdingAuthority = (closingPackage, withholdingWorkspace) => {
  const normalizedWithholdingWorkspace = normalizeWithholdingTaxWorkspace(withholdingWorkspace);
  const legacyExceptions = Array.isArray(closingPackage.exceptions)
    ? closingPackage.exceptions.filter((entry) => !LEGACY_WHT_EXCEPTION_CODES.has(entry.code))
    : [];
  const whtExceptions = (normalizedWithholdingWorkspace.exceptions || []).map((entry) => Object.freeze({
    ...entry,
    severity: entry.severity === 'BLOCKING' ? 'BLOCKER' : entry.severity,
  }));
  const readiness = {
    ...closingPackage.readiness,
    withholdingComplete: normalizedWithholdingWorkspace.readiness?.certificatesReady === true,
    withholdingEvidenceComplete: normalizedWithholdingWorkspace.readiness?.certificatesReady === true,
    withholdingFilingsSubmitted: normalizedWithholdingWorkspace.readiness?.filingsReady === true,
    withholdingReady: normalizedWithholdingWorkspace.readiness?.readyForAccountant === true,
  };
  readiness.readyForAccountingOffice = Boolean(
    readiness.outputVatReady
    && readiness.inputVatReady
    && readiness.expensesReady
    && readiness.withholdingReady
    && readiness.periodLockedOrSubmitted,
  );

  return Object.freeze({
    ...closingPackage,
    authorities: Object.freeze({
      ...(closingPackage.authorities || {}),
      withholding: 'WITHHOLDING_TAX_RECORD_CERTIFICATE_AND_FILING',
    }),
    readiness: Object.freeze(readiness),
    exceptions: Object.freeze([...legacyExceptions, ...whtExceptions]),
    withholdingSummary: normalizedWithholdingWorkspace.summary,
    withholdingFilings: normalizedWithholdingWorkspace.filings,
    withholdingRows: normalizedWithholdingWorkspace.rows,
  });
};

const getPackage = async (req, res, next) => {
  try {
    const branchId = requireBranchAuthority(req);
    const args = { branchId, taxPeriodId: req.params.taxPeriodId };
    const [closingPackage, withholdingWorkspace] = await Promise.all([
      service.loadAccountingOfficePackage(args),
      withholdingTaxService.loadWithholdingTaxWorkspace(args),
    ]);
    const data = composeWithholdingAuthority(closingPackage, withholdingWorkspace);
    return res.json({ ok: true, data });
  } catch (error) {
    return next(error);
  }
};

module.exports = Object.freeze({ getPackage, composeWithholdingAuthority });
