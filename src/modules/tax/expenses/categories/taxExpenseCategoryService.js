'use strict';

const repository = require('./taxExpenseCategoryRepository');
const { normalizeCategoryInput } = require('../shared/taxExpenseContract');

const listCategories = async ({ branchId, activeOnly }) => ({
  categories: await repository.list({ branchId, activeOnly: activeOnly === true || activeOnly === 'true' }),
});

const createCategory = async ({ branchId, input }) => {
  const category = await repository.create({ branchId, ...normalizeCategoryInput(input) });
  return { created: true, category };
};

module.exports = Object.freeze({ createCategory, listCategories });
