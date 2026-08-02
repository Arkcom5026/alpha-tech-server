'use strict';

const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const createTaxExpense = require('../create/createTaxExpenseSlice');
const listTaxExpenses = require('../query/list/listTaxExpensesSlice');
const createTaxExpenseCategory = require('../category/create/createTaxExpenseCategorySlice');
const listTaxExpenseCategories = require('../category/query/list/listTaxExpenseCategoriesSlice');
const listExpensePayeeSuppliers = require('../query/expense-payees/listExpensePayeeSuppliersSlice');

const router = express.Router();
router.use(verifyToken);

router.get('/categories', listTaxExpenseCategories.handle);
router.post('/categories', createTaxExpenseCategory.handle);
router.get('/expense-payees', listExpensePayeeSuppliers.handle);
router.get('/', listTaxExpenses.handle);
router.post('/', createTaxExpense.handle);

module.exports = router;
