'use strict';

const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const categoryRoutes = require('./categories/taxExpenseCategoryRoutes');
const expenseRoutes = require('./expenses/taxExpenseRoutes');

const router = express.Router();
router.use(verifyToken);
router.use('/expense-categories', categoryRoutes);
router.use('/expenses', expenseRoutes);

module.exports = router;
