'use strict';

const service = require('./withholdingTaxService');
const treatmentService = require('./withholdingTaxTreatmentService');
const { normalizeWithholdingTaxWorkspace } = require('./withholdingTaxReadiness');

const normalizeRole = (value) => String(value || '').trim().toUpperCase();

const requireAuthority = (req) => {
  const branchId = Number(req.query?.branchId ?? req.body?.branchId);
  const accountRole = normalizeRole(req.user?.role);
  const authorityBranchId = Number(req.user?.branchId || req.user?.employeeBranchId || req.user?.currentBranchId || 0);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    const error = new Error('branchId must be a positive integer');
    error.code = 'WHT_BRANCH_REQUIRED';
    error.statusCode = 400;
    throw error;
  }
  if (!['SUPERADMIN', 'ADMIN'].includes(accountRole) && authorityBranchId > 0 && authorityBranchId !== branchId) {
    const error = new Error('Cannot manage withholding tax for another branch');
    error.code = 'WHT_BRANCH_FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }
  return branchId;
};

const employeeId = (req) => Number(req.user?.employeeId || req.user?.employeeProfileId || req.user?.id || 0);

const requireMutablePeriod = async ({ branchId, taxPeriodId }) => {
  const workspace = await service.loadWithholdingTaxWorkspace({ branchId, taxPeriodId });
  if (String(workspace?.period?.status || '') === 'SUBMITTED') {
    const error = new Error('WHT cannot change after the tax period is submitted');
    error.code = 'WHT_PERIOD_IMMUTABLE';
    error.statusCode = 409;
    throw error;
  }
  return workspace;
};

const getWorkspace = async (req, res, next) => {
  try {
    const workspace = await service.loadWithholdingTaxWorkspace({ branchId: requireAuthority(req), taxPeriodId: req.params.taxPeriodId });
    return res.json({ ok: true, data: normalizeWithholdingTaxWorkspace(workspace) });
  } catch (error) { return next(error); }
};

const transitionTreatment = async (req, res, next) => {
  try {
    const data = await treatmentService.transitionWhtTreatment({
      branchId: requireAuthority(req),
      taxExpenseItemId: req.params.taxExpenseItemId,
      resultingTreatment: req.body?.resultingTreatment,
      note: req.body?.note,
      actorEmployeeId: employeeId(req),
    });
    return res.json({ ok: true, data });
  } catch (error) { return next(error); }
};

const issueCertificate = async (req, res, next) => {
  try {
    const data = await service.issueWithholdingCertificate({
      branchId: requireAuthority(req), taxPeriodId: req.params.taxPeriodId,
      taxExpenseId: req.body?.taxExpenseId, formType: req.body?.formType, actorEmployeeId: employeeId(req),
    });
    return res.json({ ok: true, data });
  } catch (error) { return next(error); }
};

const prepareFiling = async (req, res, next) => {
  try {
    const branchId = requireAuthority(req);
    await requireMutablePeriod({ branchId, taxPeriodId: req.params.taxPeriodId });
    const data = await service.prepareWithholdingFiling({
      branchId, taxPeriodId: req.params.taxPeriodId,
      formType: req.params.formType, actorEmployeeId: employeeId(req),
    });
    return res.json({ ok: true, data });
  } catch (error) { return next(error); }
};

const submitFiling = async (req, res, next) => {
  try {
    const data = await service.submitWithholdingFiling({
      branchId: requireAuthority(req), taxPeriodId: req.params.taxPeriodId,
      formType: req.params.formType, evidence: req.body?.evidence, actorEmployeeId: employeeId(req),
    });
    return res.json({ ok: true, data });
  } catch (error) { return next(error); }
};

module.exports = Object.freeze({ getWorkspace, transitionTreatment, issueCertificate, prepareFiling, submitFiling, requireMutablePeriod });
