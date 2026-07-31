# Core Sales Acceptance Scenarios

## Scope

These scenarios verify Core Sale Completion only. Sale Return, refund, and stock reversal are excluded.

## A. Branch authority

### A1 — Current-store stock sale

Given an authenticated employee in Branch A and an `IN_STOCK` item owned by Branch A, when the employee completes a valid paid sale, then the sale is created in Branch A and the item becomes `SOLD`.

### A2 — Cross-store stock rejection

Given an employee in Branch A and a Stock Item owned by Branch B, when completion is attempted, then completion fails without exposing or mutating Branch B data.

### A3 — Cross-store history rejection

Given a sale ID from Branch B, when an employee in Branch A requests sale detail or printable data, then the system responds as not found for the current branch.

## B. Sale lines

### B1 — Structured Stock Item

Given one valid structured Stock Item, when completion succeeds, then quantity is exactly one and the item is sold once.

### B2 — Duplicate Stock Item

Given the same Stock Item appears on two lines, when validation runs, then the command fails with duplicate-stock evidence before mutation.

### B3 — Tracked SIMPLE product

Given an active SIMPLE product, valid Simple Lot, sufficient lot quantity, and sufficient branch balance, when completion succeeds, then the lot and stock balance decrease atomically by the sold quantity.

### B4 — Missing Simple Lot

Given a tracked SIMPLE line without `simpleLotId`, when validation/completion runs, then the sale is rejected and no inventory or sale mutation remains.

### B5 — NON_STOCK SIMPLE/service line

Given an active NON_STOCK SIMPLE product, when completion succeeds, then the line is recorded without requiring or decrementing a Simple Lot or Stock Balance.

## C. Totals and VAT

### C1 — Matching totals

Given line totals, discounts, net total, and VAT that agree within runtime tolerance, when completion runs, then validation passes.

### C2 — Total mismatch

Given header totals or VAT that do not match line evidence, when completion runs, then it fails with `SALE_TOTAL_MISMATCH` and no mutation occurs.

## D. Immediate payment

### D1 — Fully paid CASH sale

Given `mode = CASH` and valid payment evidence equal to the net total, when completion succeeds, then payment status is `PAID`, completion status is `COMPLETED_PAID`, and the document default is `RECEIPT`.

### D2 — CASH payment shortfall

Given `mode = CASH` and payment evidence below the net total, when validation runs, then completion fails with `PAYMENT_TOTAL_REQUIRED`.

### D3 — Payment exceeds total

Given applied payment above the sale total, when validation runs, then completion fails with `PAYMENT_EXCEEDS_TOTAL`.

### D4 — Mixed supported payment methods

Given supported payment items whose total exactly equals the sale total, when completion succeeds, then all active evidence is recorded and payment status is `PAID`.

## E. Deposit payment

### E1 — Valid deposit usage

Given an active deposit owned by the same branch and customer with sufficient remaining value, when used in a sale, then usage is recorded and the deposit balance/status is updated atomically.

### E2 — Deposit ownership mismatch

Given a deposit owned by another customer or branch, when payment is attempted, then completion fails with no deposit or sale mutation.

### E3 — Concurrent deposit conflict

Given the deposit balance changes in another transaction before update, when completion attempts the stale balance, then it fails with `DEPOSIT_BALANCE_CONFLICT`.

## F. Credit sale

### F1 — Valid credit sale

Given `mode = CREDIT`, a valid customer, and no immediate CASH/TRANSFER/CARD evidence, when completion succeeds, then an outstanding sale is created, the initial document default is `DELIVERY_NOTE`, and completion reports credit/outstanding state.

### F2 — Credit without customer

Given `mode = CREDIT` without customer, when validation runs, then it fails with `CREDIT_CUSTOMER_REQUIRED`.

### F3 — Credit with forbidden immediate payment

Given `mode = CREDIT` with CASH, TRANSFER, or CARD evidence, when validation runs, then it fails with `CREDIT_IMMEDIATE_PAYMENT_FORBIDDEN`.

### F4 — Later settlement below total

Given a credit sale whose active payment evidence remains below total, when `mark-paid` is requested, then it returns conflict with total, paid, and balance evidence.

### F5 — Later settlement reaches total

Given active payment evidence reaches the canonical total, when `mark-paid` runs, then the sale projects as paid/completed.

## G. Held Cart

### G1 — Valid Held Cart completion

Given an `OPEN` Held Cart in the current branch whose lines match the completion command, when completion runs, then it may be used as source authority.

### G2 — Held Cart version or snapshot changed

Given the Held Cart lines changed after the user loaded it, when completion runs with the stale snapshot, then it fails with `HELD_CART_SNAPSHOT_CONFLICT`.

### G3 — Revalidation finds unavailable item

Given a Held Cart line is no longer available, when revalidation runs, then `ready = false` and the affected line reports an availability code.

### G4 — Revalidation finds price change

Given current branch price differs from the Held Cart unit price, when revalidation runs, then the result marks `priceChanged = true` for employee review.

## H. Idempotency

### H1 — Safe replay

Given a completed command, when the identical payload is retried with the same command ID, then the system returns the prior canonical result with replay evidence and does not duplicate sale, stock, payment, or tax-candidate mutation.

### H2 — Command conflict

Given an existing command ID, when it is reused with changed sale or payment data, then the system rejects the request as an idempotency conflict.

## I. History and printable recovery

### I1 — Printable search

Given a non-cancelled sale in the current branch, when searched by supported keyword/date/payment filters, then the row includes total, paid amount, balance, customer, employee, credit flag, and payment state.

### I2 — Paid/unpaid filters

Given paid, partially paid, and unpaid sales, when payment filters are applied, then only matching current-branch rows are returned.

### I3 — Detail projection

Given a mixed sale, when detail is requested, then the result contains both structured items and SIMPLE items, payments, totals, received amount, balance, and change.

## J. Human Operational Test

Before acceptance, a human operator verifies in the current Sales UI:

1. Search and add one structured item.
2. Add one tracked SIMPLE item where available.
3. Add one NON_STOCK/service-style item where available.
4. Save or resume a Held Cart and revalidate it.
5. Complete one immediate paid sale with valid evidence.
6. Confirm receipt/default document behavior and printable history.
7. Create one credit sale with a customer and confirm delivery-note/outstanding behavior.
8. Confirm a payment-shortfall path is blocked with understandable feedback.
9. Confirm no sales, customer deposits, or stock from another store are exposed.

Record the tested SHA, environment, operator, date/time, sale IDs, and observed PASS/FAIL. Human testing must not use or mutate production records unless explicitly authorized.
