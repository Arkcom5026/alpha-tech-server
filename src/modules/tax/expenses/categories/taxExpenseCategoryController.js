'use strict';

const service = require('./taxExpenseCategoryService');
const { resolveTaxExpenseAuthority } = require('../shared/taxExpenseAuthority');

const handle = (operation) => async (req, res, next) => {
  try {
    const result = await operation(req);
    return res.status(result?.created ? 201 : 200).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const listCategories = handle((req) => {
  const authority = resolveTaxExpenseAuthority({ user: req.user, requestedBranchId: req.query.branchId });
  return service.listCategories({ branchId: authority.branchId, activeOnly: req.query.activeOnly });
});

const createCategory = handle((req) => {
  const authority = resolveTaxExpenseAuthority({ user: req.user, requestedBranchId: req.body?.branchId });
  return service.createCategory({ branchId: authority.branchId, input: req.body });
});

module.exports = Object.freeze({ createCategory, listCategories });
