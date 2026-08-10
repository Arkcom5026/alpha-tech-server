'use strict';

const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const createTaxExpense = require('../create/createTaxExpenseSlice');
const listTaxExpenses = require('../query/list/listTaxExpensesSlice');
const createTaxExpenseCategory = require('../category/create/createTaxExpenseCategorySlice');
const listTaxExpenseCategories = require('../category/query/list/listTaxExpenseCategoriesSlice');
const createExpensePayee = require('../expense-payee/create/createExpensePayeeSlice');
const listExpensePayees = require('../expense-payee/query/list/listExpensePayeesSlice');
const taxExpenseAssessment = require('../assessment/taxExpenseAssessmentController');

const router = express.Router();
router.use(verifyToken);

router.get('/categories', listTaxExpenseCategories.handle);
router.post('/categories', createTaxExpenseCategory.handle);
router.get('/expense-payees', listExpensePayees.handle);
router.post('/expense-payees', createExpensePayee.handle);
router.get('/:taxExpenseId/assessment-suggestion', taxExpenseAssessment.getSuggestion);
router.post('/:taxExpenseId/assessment-confirmation', taxExpenseAssessment.confirm);
router.get('/', listTaxExpenses.handle);
router.post('/', createTaxExpense.handle);

module.exports = router;
