'use strict';

const service = require('./taxExpenseService');
const { resolveTaxExpenseAuthority } = require('../shared/taxExpenseAuthority');

const handle = (operation) => async (req, res, next) => {
  try {
    const result = await operation(req);
    return res.status(result?.created ? 201 : 200).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const createExpense = handle((req) => {
  const authority = resolveTaxExpenseAuthority({ user: req.user, requestedBranchId: req.body?.branchId });
  return service.createExpense({ branchId: authority.branchId, employeeId: authority.employeeId, input: req.body });
});

const listExpenses = handle((req) => {
  const authority = resolveTaxExpenseAuthority({ user: req.user, requestedBranchId: req.query.branchId });
  return service.listExpenses({ branchId: authority.branchId, input: req.query });
});

const getExpenseDetail = handle((req) => {
  const authority = resolveTaxExpenseAuthority({ user: req.user, requestedBranchId: req.query.branchId });
  return service.getExpenseDetail({ branchId: authority.branchId, taxExpenseId: req.params.taxExpenseId });
});

const recordExpense = handle((req) => {
  const authority = resolveTaxExpenseAuthority({ user: req.user, requestedBranchId: req.body?.branchId });
  return service.recordExpense({ branchId: authority.branchId, employeeId: authority.employeeId, taxExpenseId: req.params.taxExpenseId });
});

module.exports = Object.freeze({ createExpense, getExpenseDetail, listExpenses, recordExpense });
