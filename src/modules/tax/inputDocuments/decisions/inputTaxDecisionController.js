'use strict';

const service = require('./inputTaxDecisionService');
const {
  InputTaxCapability,
  assertInputTaxAuthority,
} = require('../../policies/inputTaxAccessPolicy');

const resolveAuthority = (req, source, capability) => assertInputTaxAuthority({
  user: req.user,
  requestedBranchId: source?.branchId,
  capability,
  accessForbiddenCode: 'INPUT_TAX_DECISION_ACCESS_FORBIDDEN',
  branchForbiddenCode: 'INPUT_TAX_DECISION_BRANCH_FORBIDDEN',
  actorRequiredCode: 'INPUT_TAX_DECISION_ACTOR_REQUIRED',
  requireActor: true,
});

const handle = (operation) => async (req, res, next) => {
  try {
    const result = await operation(req);
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const decideDuplicate = handle((req) => {
  const authority = resolveAuthority(req, req.body, InputTaxCapability.DECIDE_DUPLICATE);
  return service.decideDuplicate({
    branchId: authority.branchId,
    taxDocumentId: req.params.taxDocumentId,
    decision: req.body?.decision,
    reason: req.body?.reason,
    evidence: req.body?.evidence || null,
    actorEmployeeId: authority.actorEmployeeId,
  });
});

const linkReplacement = handle((req) => {
  const authority = resolveAuthority(req, req.body, InputTaxCapability.DECIDE_REPLACEMENT);
  return service.linkReplacement({
    branchId: authority.branchId,
    taxDocumentId: req.params.taxDocumentId,
    replacesTaxDocumentId: req.body?.replacesTaxDocumentId,
    reason: req.body?.reason,
    evidence: req.body?.evidence || null,
    actorEmployeeId: authority.actorEmployeeId,
  });
});

module.exports = Object.freeze({ decideDuplicate, linkReplacement });
