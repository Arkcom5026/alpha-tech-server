'use strict';

const repository = require('./taxExpenseRepository');
const {
  normalizeCreateExpenseInput,
  normalizeListFilters,
  positiveInteger,
} = require('../shared/taxExpenseContract');

const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const createExpense = async ({ branchId, employeeId, input }) => {
  const expense = await repository.create({
    branchId,
    employeeId,
    expense: normalizeCreateExpenseInput(input),
  });
  return { created: true, expense };
};

const listExpenses = async ({ branchId, input }) => {
  const expenses = await repository.list({ branchId, filters: normalizeListFilters(input) });
  return { expenses, total: expenses.length };
};

const getExpenseDetail = async ({ branchId, taxExpenseId }) => {
  const id = positiveInteger(taxExpenseId, 'taxExpenseId', { required: true });
  const expense = await repository.findById({ branchId, taxExpenseId: id });
  if (!expense) fail('TAX_EXPENSE_NOT_FOUND', 'Tax expense not found', 404);
  return expense;
};

const recordExpense = async ({ branchId, employeeId, taxExpenseId }) => {
  const id = positiveInteger(taxExpenseId, 'taxExpenseId', { required: true });
  const expense = await repository.record({ branchId, employeeId, taxExpenseId: id });
  if (!expense) fail('TAX_EXPENSE_NOT_FOUND', 'Tax expense not found', 404);
  return { expense };
};

module.exports = Object.freeze({ createExpense, getExpenseDetail, listExpenses, recordExpense });
