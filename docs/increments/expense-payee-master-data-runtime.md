# ExpensePayee Master Data Runtime

## Mission

Introduce dedicated ExpensePayee master-data runtime endpoints for Tax Expense without reading or mutating Supplier records.

## Scope

- `GET /api/tax-expenses/expense-payees`
- `POST /api/tax-expenses/expense-payees`
- Branch isolation from the authenticated token
- Creator authority from the authenticated employee token
- Search by name, tax ID, phone, and contact person
- Active ExpensePayee records only

## Domain Boundary

Supplier and ExpensePayee are independent records even when they represent the same real-world person or organization. No automatic synchronization, conversion, or combined listing is allowed.

## Deferred

- Linking `expensePayeeId` into Tax Expense creation
- ExpensePayee update/deactivation UI
- Client-side master-data workspace
- Browser E2E

## Verification

- `node tests/tax-expense-runtime.contract.test.js`
- `node tests/expense-payee-master-data-runtime.contract.test.js`

Runtime verification remains pending until the branch is pulled and tested on the local main candidate.
