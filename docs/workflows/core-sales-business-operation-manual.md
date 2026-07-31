# Core Sales Business Operation Manual

## 1. Purpose

This manual explains how Alpha-Tech employees operate the Core Sales workflow from item selection through sale completion, immediate payment or credit creation, initial document handling, and later sale lookup.

This manual is a documentation projection of verified Sales runtime behavior. It does not replace Server validation, inventory authority, payment evidence, or branch isolation.

Sale Return, refund, stock reversal, and return approval are outside this manual and require a separate workflow.

## 2. Actors and authority

- Sales employee prepares the cart, customer, price type, sale mode, payment evidence, and document option.
- Manager or authorized employee handles exceptional cases under store policy.
- The authenticated Server context owns `branchId` and `employeeId`.
- Inventory, customer deposit, payment, and sale history are isolated to the current branch.

Employees must not use a stock item, Simple Lot, deposit, Held Cart, or sale from another branch.

## 3. Core workflow overview

```text
Start a new sale
→ select customer when required
→ select price type
→ scan or search products
→ verify cart lines and quantities
→ optionally save or resume a Held Cart
→ choose CASH or CREDIT
→ verify totals, VAT, discount, and payment evidence
→ confirm sale using a stable command identity
→ Server revalidates branch, inventory, Held Cart, totals, and payment
→ Server creates Sale and lines inside one transaction
→ tracked inventory is mutated atomically
→ payment evidence is posted when supplied
→ initial receipt or delivery-note default is returned
→ tax candidate publication is attempted
→ sale becomes searchable in history and printable views
```

## 4. Preparing a sale

### 4.1 Customer

A customer is optional for a normal immediate sale unless store policy requires one.

A customer is mandatory when:

- the sale is CREDIT;
- a customer deposit is used;
- customer-specific document or payment information is required.

The selected customer must be valid for the current workflow. CREDIT without a customer is rejected.

### 4.2 Price type

The selling UI may offer retail, technician, or wholesale prices. The employee must verify the selected price type before adding or confirming items.

A Held Cart records its price type as part of its snapshot. When resumed, current prices may differ and must be reviewed.

### 4.3 Sale line types

#### Structured Stock Item

A structured or serialized item is sold as `STOCK_ITEM`.

Rules:

- quantity is exactly one;
- the same Stock Item cannot appear twice;
- it must be `IN_STOCK` in the current branch at completion time;
- successful completion changes it to `SOLD` atomically.

#### Tracked SIMPLE product

A tracked SIMPLE product is sold by quantity and must have inventory authority.

Rules:

- an appropriate `simpleLotId` is required;
- the lot belongs to the same product and branch;
- the lot has sufficient remaining quantity;
- the branch stock balance has sufficient available quantity;
- successful completion decrements both lot and balance atomically.

#### NON_STOCK SIMPLE / service-style line

A NON_STOCK SIMPLE product is recorded as a sale line without requiring or decrementing a Simple Lot or Stock Balance.

The product must still be active and sellable in the current branch.

## 5. Cart totals, discount, and VAT

Before completion, the system validates that:

- every line has a unique line ID;
- header total before discount matches line evidence;
- total discount matches line discounts;
- net total matches the sum of line prices;
- net total equals total before discount minus discount;
- VAT agrees with runtime calculation within tolerance.

A mismatch is rejected before any sale, inventory, payment, or tax mutation remains.

## 6. Held Cart workflow

Held Cart is a resumable sales snapshot, not inventory reservation authority.

### 6.1 Save a Held Cart

Use Held Cart when the customer is still selecting products or the transaction must continue later.

The snapshot may contain:

- customer identity or display information;
- price type;
- item lines and quantities;
- notes;
- calculated totals.

After saving, the current sales page may be cleared for a new sale.

### 6.2 Resume a Held Cart

When opening a Held Cart:

1. load only OPEN carts in the current branch;
2. revalidate every line against current stock, lot quantity, balance, and price;
3. review any unavailable item;
4. review any changed price;
5. update the cart before completion when needed.

### 6.3 Snapshot and version conflicts

A Held Cart may have been changed by another device or employee. Version and snapshot conflicts require loading the latest cart again.

Completion rejects a source Held Cart when:

- it is missing in the current branch;
- it is no longer OPEN;
- its latest lines do not match the sale command.

### 6.4 Cancel a Held Cart

Cancellation requires a reason. A cancelled or completed Held Cart must not be resumed as OPEN.

## 7. Immediate sale — CASH mode

CASH mode represents an immediately settled sale. Supported payment methods are:

- `CASH`;
- `TRANSFER`;
- `CARD`;
- `DEPOSIT`.

Multiple supported payment items may be combined.

Rules:

- positive payment evidence must total exactly the net sale total within tolerance;
- payment above the total is rejected;
- payment below the total is rejected;
- unsupported methods are rejected;
- a deposit payment requires `customerDepositId`.

A successful immediate sale normally returns:

- payment status `PAID`;
- completion status `COMPLETED_PAID`;
- default document option `RECEIPT`.

## 8. Customer deposit payment

A deposit may be used only when it is:

- ACTIVE;
- owned by the current branch;
- owned by the selected customer;
- sufficient for the requested usage.

Deposit usage is recorded in the same transaction as the sale payment evidence.

If another transaction changes the deposit first, the stale transaction fails with a balance conflict. The employee must reload the latest deposit amount and retry deliberately.

## 9. Credit sale — CREDIT mode

CREDIT mode creates an outstanding sale.

Rules:

- a valid customer is required;
- immediate CASH, TRANSFER, or CARD evidence is forbidden in the completion command;
- the due date may be derived from customer payment terms;
- initial payment status may remain `UNPAID`;
- the default document option is `DELIVERY_NOTE`;
- the sale may remain in the configured credit status until settled.

A credit sale still performs inventory validation and tracked stock mutation at completion.

## 10. Later settlement and mark-paid

A sale may be marked paid only when active payment evidence reaches the canonical total.

If payment evidence is insufficient, the operation returns a conflict containing:

- total amount;
- paid amount;
- outstanding balance.

The employee must post or verify the missing payment evidence before requesting mark-paid again.

When the total is fully covered, the payment projection becomes `PAID` and the sale may be projected as completed.

## 11. Sale completion transaction

The completion command requires a stable command identity.

Inside the completion transaction, the Server:

1. verifies safe replay or command conflict;
2. locks and verifies the source Held Cart when supplied;
3. validates customer and sale mode;
4. validates structured, tracked SIMPLE, and NON_STOCK lines;
5. validates totals and VAT;
6. creates the Sale and both `items` and `simpleItems` as applicable;
7. changes structured items to SOLD;
8. decrements tracked Simple Lots and Stock Balances;
9. records stock movements;
10. posts payment evidence and consumes deposits when applicable;
11. projects payment state;
12. records completion command authority;
13. returns canonical completion and document defaults.

Any failure inside the transaction rolls back the sale and tracked mutations.

## 12. Idempotency and retry

The Client keeps a stable completion identity during uncertain retry conditions.

### Safe replay

When the same command ID and materially identical payload are retried, the Server returns the prior canonical result without duplicating:

- Sale;
- stock mutation;
- payment;
- deposit usage;
- tax-candidate mutation.

### Command conflict

When an existing command ID is reused with changed sale or payment data, the request is rejected. Generate a new command only for a genuinely new business action.

Do not repeatedly click confirm after an uncertain response while changing the cart or payment data.

## 13. Documents

The completion result provides initial document defaults:

- immediate paid sale → `RECEIPT`;
- credit sale → `DELIVERY_NOTE`.

Document rendering and descriptions must include both structured `items` and `simpleItems` where relevant.

The employee should verify:

- customer and company details;
- sale code;
- item descriptions;
- quantities and prices;
- discount, VAT, and total;
- paid and outstanding amounts;
- receipt or delivery-note choice.

## 14. Tax candidate boundary

After successful completion, the Server attempts to publish a sales tax candidate.

The tax candidate is a downstream tax-intake boundary. It does not replace the completed Sale as sales authority, and failure handling must not invent a second Sale.

Tax review, tax document lifecycle, tax period closing, and filing are separate workflows.

## 15. History and printable recovery

Sales history and printable search are branch-isolated.

Supported lookup may include:

- sale code;
- note;
- customer or company name;
- date range;
- paid, unpaid, or partially paid filters.

Sale detail may include:

- structured items;
- SIMPLE items;
- payments and payment items;
- total before discount;
- discount;
- VAT and total;
- received amount;
- outstanding balance;
- change amount;
- credit and payment status.

Use history after an uncertain UI response to verify whether the sale was already completed before retrying.

## 16. Common failures and recovery

### Stock item unavailable

Cause: item was sold, moved, or changed before completion.

Recovery: remove the unavailable item, scan the correct current-branch item, and submit a new valid command.

### SIMPLE quantity unavailable

Cause: lot or balance no longer has sufficient quantity.

Recovery: reload product availability, select a valid lot or quantity, and verify the cart again.

### Held Cart snapshot conflict

Cause: the Held Cart changed after it was loaded.

Recovery: reopen the latest Held Cart and review all lines and prices.

### Total or VAT mismatch

Cause: header evidence no longer agrees with cart lines.

Recovery: recalculate the cart and submit the current authoritative totals.

### CASH payment total required

Cause: immediate payment evidence is below or different from the net total.

Recovery: correct payment methods and amounts until the net total is covered exactly.

### Payment exceeds total

Cause: applied payment is above the sale total.

Recovery: reduce or remove the excess payment evidence.

### Credit customer required

Cause: CREDIT was selected without a customer.

Recovery: select or create the correct customer before completing the sale.

### Credit immediate payment forbidden

Cause: CASH, TRANSFER, or CARD evidence was included in CREDIT completion.

Recovery: remove forbidden immediate payment evidence or change the sale to CASH when that reflects the real transaction.

### Deposit not usable

Cause: deposit is inactive, belongs to another customer/branch, or has insufficient remaining value.

Recovery: reload the customer's deposits and select a valid current-branch deposit.

### Idempotency conflict

Cause: the same command ID was reused with materially changed data.

Recovery: verify the prior result in history. Use a new command only for a new sale attempt.

### Mark-paid conflict

Cause: active payment evidence remains below the canonical total.

Recovery: inspect total, paid, and balance evidence; post the missing payment before retrying.

## 17. Employee checklist

Before confirmation:

- current branch and employee session are correct;
- customer is selected when required;
- price type is correct;
- structured items are unique and current;
- tracked SIMPLE quantities and lots are correct;
- service-style lines are intended as NON_STOCK;
- discounts, VAT, and net total are correct;
- Held Cart warnings and changed prices are resolved;
- CASH payment evidence equals the net total;
- CREDIT has a customer and no forbidden immediate payment;
- deposit belongs to the selected customer and branch;
- document option matches the transaction.

After confirmation:

- verify the returned sale code;
- verify payment and outstanding status;
- open the expected receipt or delivery note;
- confirm the sale is searchable in current-branch history;
- do not create a duplicate sale after an uncertain response without checking history.

## 18. Acceptance boundary

Repository documentation, focused contracts, and build checks do not constitute operational acceptance alone.

Before acceptance, a human operator records:

- tested Client and Server SHA;
- environment;
- operator and date/time;
- immediate paid sale evidence;
- credit sale evidence;
- Held Cart resume/revalidation evidence;
- structured, SIMPLE, and NON_STOCK behavior where available;
- receipt/delivery-note and printable history evidence;
- PASS/FAIL and unresolved defects.

Core Sales remains pending operational acceptance until that evidence is recorded and reviewed.
