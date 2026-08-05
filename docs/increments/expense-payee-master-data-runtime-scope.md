# Scope Lock

This increment intentionally stops at dedicated ExpensePayee master-data runtime.

It must not:

- list Supplier records as ExpensePayee records
- copy Supplier records into ExpensePayee automatically
- accept branch authority from request bodies
- accept creator authority from request bodies
- change Tax Expense creation from `supplierId` to `expensePayeeId`
- introduce new Prisma schema or migration changes
