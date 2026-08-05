# Local Verification Mission

Branch: `feature/expense-payee-master-data-runtime`

Run:

```powershell
node tests/tax-expense-runtime.contract.test.js
node tests/expense-payee-master-data-runtime.contract.test.js
npx prisma validate
npx prisma generate
```

Expected:

- Tax expense runtime contract: PASS
- Expense payee master data runtime contract: PASS
- Prisma schema valid
- Prisma Client generated
- No Supplier-backed ExpensePayee route remains
- Working tree clean except approved local backup artifacts
