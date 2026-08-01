'use strict';

const express = require('express');
const controller = require('./taxExpenseController');

const router = express.Router();
router.get('/', controller.listExpenses);
router.post('/', controller.createExpense);
router.get('/:taxExpenseId', controller.getExpenseDetail);
router.post('/:taxExpenseId/record', controller.recordExpense);

module.exports = router;
