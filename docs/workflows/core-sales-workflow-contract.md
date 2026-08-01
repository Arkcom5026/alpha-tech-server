# Core Sales Workflow Contract

## 1. Workflow identity

- Workflow: Core Sales
- Owning domain: `sales`
- Scope: item selection through sale completion, immediate payment or credit creation, initial document defaults, downstream tax-candidate publication, and later printable/history lookup
- Explicit exclusion: Sale Return, stock reversal, refund, and return approval

## 2. Actors

- Sales employee: prepares cart, customer, sale mode, payment evidence, and completes the sale
- Manager or authorized employee: resolves operational exceptions according to store policy
- Customer: purchaser, required for credit sales and deposit usage
- System: validates totals, inventory, payment evidence, held-cart snapshot, idempotency, and branch authority

Every command operates under authenticated `branchId` and `employeeId`.

## 3. Trigger

The workflow begins when an authenticated employee prepares one or more sellable lines and commits to complete a sale.

## 4. Preconditions

1. The authenticated employee has a valid current branch.
2. At least one sale line exists.
3. Every line has a unique `lineId`.
4. A structured stock item is referenced only once and remains `IN_STOCK` in the current branch.
5. A tracked SIMPLE product has a valid Simple Lot in the current branch and sufficient lot and stock-balance quantity.
6. A NON_STOCK SIMPLE/service-style product is active and sellable in the current branch; it does not require stock deduction.
7. Totals, discount, VAT, and line evidence agree within the runtime tolerance.
8. A stable `commandId` of 16–128 allowed characters exists.
9. Credit mode has a customer.
10. Deposit payment references an active deposit belonging to the same customer and branch.
11. When a Held Cart is the source, it is still `OPEN`, belongs to the current branch, and its latest snapshot matches the sale command.

## 5. Inputs

### Sale header

- customer, when applicable
- `mode`: `CASH` or `CREDIT`
- sale type, note, VAT and document preferences
- optional `sourceHeldCartId`

### Sale lines

- `STOCK_ITEM`: one serialized/structured stock item, quantity fixed to 1
- `SIMPLE` tracked: product, quantity, and Simple Lot
- `SIMPLE` non-stock: product and quantity without stock mutation
- price, discount, VAT evidence, and optional document descriptions

### Payment evidence

Supported methods:

- `CASH`
- `TRANSFER`
- `CARD`
- `DEPOSIT`

Payment evidence may include note, slip image, card reference, and customer deposit authority.

## 6. Main path — immediate sale

```text
Prepare cart
→ select customer when needed
→ choose CASH mode
→ verify every line and totals
→ provide payment evidence equal to the net sale total
→ submit stable commandId
→ lock and revalidate Held Cart when supplied
→ verify inventory and Simple Lot authority
→ create Sale and Sale lines
→ mutate tracked inventory atomically
→ post payment evidence
→ project payment status as PAID
→ convert source Held Cart when supplied
→ commit Sale transaction
→ return canonical completion and receipt defaults
→ attempt downstream tax-candidate publication
```

A successful immediate sale reports `completionStatus = COMPLETED_PAID` and defaults to `RECEIPT`.

The Sale transaction is authoritative before tax-candidate publication. A downstream tax-publication failure returns `PENDING_RETRY` and must not cause the employee to create a duplicate Sale.

## 7. Alternative path — credit sale

```text
Prepare cart
→ select customer
→ choose CREDIT mode
→ do not include immediate CASH / TRANSFER / CARD payment
→ verify customer and payment terms
→ submit stable commandId
→ complete inventory and Sale transaction
→ create outstanding sale
→ convert source Held Cart when supplied
→ commit Sale transaction
→ default initial document to DELIVERY_NOTE
→ attempt downstream tax-candidate publication when the Sale status is tax-ready
```

Rules:

- Credit sale requires a customer.
- Immediate cash, transfer, or card evidence is forbidden in the credit-completion command.
- The runtime may derive due date from customer payment terms.
- Initial completion may report `COMPLETED_CREDIT`, `UNPAID`, or an outstanding balance.
- A later settlement can close the sale only after non-cancelled payment evidence reaches the canonical total.
- Tax-candidate publication may be skipped when the current Sale status is not tax-ready.

## 8. Held Cart contract

Held Cart is optional and remains a snapshot, not inventory ownership.

- List and detail are branch-scoped.
- Update requires the expected version.
- Revalidation checks current item availability and current branch price.
- A completion sourced from Held Cart must match the latest line snapshot.
- A changed, cancelled, or non-open cart blocks completion.
- Successful completion atomically converts the source Held Cart from `OPEN` to `CONVERTED`.
- Price changes or unavailable stock require employee review before retry.

## 9. Inventory behavior

### Structured stock

- Stock Item must belong to the current branch and be `IN_STOCK`.
- On successful completion it becomes `SOLD`.
- A concurrent change causes a stock conflict and the transaction fails.

### Tracked SIMPLE

- `simpleLotId` is required.
- Lot product, branch, status, and quantity must match.
- Branch Stock Balance availability must be sufficient after reservations.
- Completion decrements both Simple Lot and Stock Balance atomically.

### NON_STOCK SIMPLE

- Product must be active and sellable in the current branch.
- No Simple Lot is required.
- No inventory deduction is performed.

## 10. Payment contract

- CASH completion requires payment evidence equal to the net sale total.
- Applied payment cannot exceed the sale total.
- Deposit requires `customerDepositId` and branch/customer ownership.
- Deposit use is protected from concurrent consumption.
- Payment status projection is:
  - `UNPAID`
  - `PARTIALLY_PAID`
  - `PAID`
- Later `mark-paid` succeeds only when active payment evidence reaches the canonical total.

## 11. Idempotency

- Completion requires a stable command ID.
- The normalized request generates a request hash.
- Reusing the same command ID with the same hash returns the canonical prior Sale result.
- Reusing the same command ID with a different payload is a conflict.
- Client retry after timeout should preserve the same command ID only for the same unchanged command.
- Tax-candidate registration has its own replay-safe downstream boundary and does not redefine Sale authority.

## 12. Outputs

Successful completion produces:

- Sale ID and sale code
- persisted stock and SIMPLE lines
- payment records and payment summary
- `COMPLETED_PAID` or `COMPLETED_CREDIT`
- receipt or delivery-note document defaults
- idempotency replay information
- downstream tax-publication result:
  - `REGISTERED`
  - `REPLAYED`
  - `SKIPPED`
  - `PENDING_RETRY`

A `PENDING_RETRY` tax result means the Sale remains completed and tax intake requires a downstream retry path; it does not authorize creating another Sale.

## 13. History and printable recovery

- History and detail lookup are branch-scoped.
- Printable search excludes cancelled sales.
- Search supports sale code, note, customer or company, dates, and payment filters.
- Detail projection includes both structured `items` and `simpleItems`, payments, canonical totals, received amount, balance, and change.
- An employee must not use a sale identifier from another store to access or print data.

## 14. Exceptions and recovery

| Condition | Required response |
|---|---|
| Stock Item unavailable | Refresh search/cart; select currently available stock |
| Simple Lot or balance insufficient | Refresh product availability; adjust quantity or lot |
| Held Cart snapshot conflict | Reload and revalidate the Held Cart before retry |
| Price changed | Review current branch price and rebuild/confirm line evidence |
| Totals or VAT mismatch | Recalculate from current cart evidence; do not override runtime totals |
| Missing credit customer | Select the correct customer before credit completion |
| Deposit unusable or conflicted | Reload deposit balance; choose valid payment evidence |
| Payment evidence below CASH total | Complete payment evidence before immediate completion |
| Same command ID with changed payload | Generate a new command ID for the changed command |
| Timeout after submission | Retry the identical command with the same command ID |
| Tax publication `PENDING_RETRY` | Verify the Sale in history; do not resubmit the Sale; use the tax retry/reconciliation path |
| Printable sale not found | Verify branch, search filters, and non-cancelled status |

## 15. Permissions and isolation

All operational search, Held Cart, completion, settlement, history, payment, inventory, deposit, and printable access is scoped to the authenticated branch. Cross-store aggregation is outside normal store authority.

## 16. Acceptance boundary

This Contract establishes documented behavior. Acceptance still requires:

- focused automated verification
- Production Build
- independent review
- Human Operational Test of the main sales UI
- explicit merge decision

Documentation does not prove production deployment or real payment/inventory mutation by itself.
