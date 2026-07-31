# Sale Return Business Operation Manual

## 1. Purpose

This manual defines the operational procedure for returning items from an existing Sale in Alpha-Tech. It is a business-operation guide derived from the current Sale Return runtime authority. It does not replace Server validation, approval policy, transaction rules, or branch isolation.

The operational objective is to complete a return safely without:

- returning items from another store;
- returning more than the remaining eligible quantity;
- refunding more than the eligible value;
- refunding through unrelated payment evidence;
- bypassing deduction approval;
- restoring stock without a completed Sale Return transaction;
- creating duplicate returns after an uncertain response;
- assuming Credit Note or tax-adjustment behavior that runtime evidence does not support.

## 2. Scope

This manual covers:

- searching for an original Sale that can be returned;
- loading return eligibility;
- selecting serialized items;
- selecting SIMPLE quantities;
- reviewing remaining returnable quantity and value;
- entering return reasons;
- assigning refund channels and source payment evidence;
- handling deducted refunds;
- completing the Sale Return;
- confirming stock restoration and refund evidence;
- retrying safely after timeout or uncertain response;
- reviewing Sale Return history and detail;
- handling business and runtime errors.

This manual does not certify that Credit Note creation, tax adjustment, accounting posting, or cash-disbursement settlement is already implemented unless separate runtime evidence proves those capabilities.

## 3. Actors and authority

### 3.1 Store employee

An authenticated employee may operate only within the current authenticated `branchId`.

The employee may:

- search for returnable Sales in the current store;
- open eligibility for a Sale in the current store;
- select eligible serialized or SIMPLE items;
- enter reasons and refund evidence;
- submit a return when all policies are satisfied.

The employee must not:

- use a Sale from another store;
- use payment evidence from another Sale;
- alter remaining eligibility manually;
- retry with a new command identity merely because the first response was uncertain.

### 3.2 Deduction approver

A return with a deducted refund means the actual refund is lower than the eligible return value.

The current approval policy accepts an authorized role from the actor or employee authority. Supported roles include:

- `OWNER`
- `MANAGER`
- `ADMIN`
- `SUPER_ADMIN`

A deducted refund requires:

- a clear free-text reason;
- an authorized approver;
- refund evidence matching the approved actual refund total.

### 3.3 Server authority

The Server remains authoritative for:

- branch ownership;
- employee context;
- eligibility;
- remaining returnable quantities;
- remaining refundable value;
- source-payment ownership and refundable balance;
- deduction approval;
- stock restoration;
- refund evidence;
- idempotency and replay conflict;
- transaction commit or rollback.

## 4. Canonical operating path

The active Client runtime uses the Sales-owned Sale Return module and the canonical route namespace:

- returnable Sales: `GET /sales/return`
- eligibility: `GET /sales/returns/eligible/:saleId`
- completion: `POST /sales/returns/complete`

A compatibility route remains available for legacy callers. Operators should use the active POS Sale Return screens rather than manually selecting API paths.

## 5. Standard operating procedure

### Step 1 — Open Sale Return

Open the Sale Return function from the Sales workflow.

Expected result:

- the system shows Sales eligible for return in the current store;
- Sales from unrelated stores do not appear;
- the employee does not need to enter another store identifier manually.

### Step 2 — Find the original Sale

Search for the Sale using the available identifiers shown by the active UI, such as Sale code, customer context, or other supported lookup information.

Confirm:

- the Sale belongs to the current store;
- the Sale is the correct original transaction;
- the customer and document context are correct before continuing.

Do not continue when the Sale identity is uncertain.

### Step 3 — Load eligibility

Open the selected Sale to load authoritative return eligibility.

Eligibility should show, as supported by the Sale:

- serialized Sale Items;
- SIMPLE Sale Items;
- remaining returnable quantity;
- eligible refund value;
- prior-return effects;
- payment evidence available for refund-source validation.

The eligibility response is a current projection. It may become stale if another return completes concurrently.

### Step 4 — Select serialized items

For a serialized item:

- select the exact Sale Item;
- verify serial number or unique item identity;
- confirm the item has not already been returned;
- quantity is treated as one item.

Do not substitute a different serial number or choose a stock item merely because it has the same product model.

### Step 5 — Select SIMPLE quantities

For a SIMPLE item:

- select the Sale line;
- enter the quantity being returned;
- confirm the quantity is positive;
- confirm it does not exceed the remaining eligible quantity.

Partial return is allowed when current eligibility permits it.

### Step 6 — Enter item and return reasons

Enter a clear reason for the return.

When the refund is deducted below the eligible value, a free-text reason is mandatory. The reason should explain the business basis, for example:

- missing packaging;
- damaged accessory;
- usage-related deduction;
- agreed service or restocking deduction.

Do not use vague text such as “other” when a deduction requires management accountability.

### Step 7 — Review eligible and actual refund

For every selected item, compare:

- eligible refund value;
- requested refund amount;
- deducted amount, if any.

Rules:

- requested refund must not exceed eligible value;
- total actual refund must equal the sum of refund evidence;
- deducted amount must not be negative;
- deducted returns require reason and authority.

### Step 8 — Select refund channels

Record the actual refund channels supported by the active workflow.

Each refund entry may include:

- refund method;
- amount;
- source payment item, where applicable;
- reference number;
- note.

When a source payment item is used:

- it must belong to the original Sale;
- the requested refund must not exceed its remaining refundable balance.

Do not use payment evidence from another Sale, customer, or store.

### Step 9 — Obtain approval for deducted refund

When actual refund is lower than eligible value:

- confirm the deduction amount;
- confirm the free-text reason;
- obtain an authorized role;
- do not share credentials or impersonate an approver.

If approval is unavailable, stop and keep the return uncompleted until an authorized person is available.

### Step 10 — Final review before completion

Before pressing the completion action, confirm:

- correct original Sale;
- correct current store;
- correct serialized identities;
- correct SIMPLE quantities;
- correct eligible and actual refund totals;
- correct refund channels;
- correct source payment evidence;
- deduction reason and authority, if required.

### Step 11 — Complete the Sale Return

Submit once and wait for the result.

The Server transaction is responsible for completing the business authority together, including:

- Sale Return header;
- returned-item records;
- stock restoration;
- stock movement;
- refund evidence;
- completion-command identity.

A failure before commit should roll back the transaction rather than leaving a partially completed return.

### Step 12 — Confirm the result

After success, verify:

- Sale Return code or identifier;
- returned items and quantities;
- actual refund total;
- refund evidence;
- stock restoration result;
- return history/detail availability.

Do not assume accounting or tax documents exist merely because the Sale Return completed.

## 6. Stock restoration rules

### 6.1 Serialized item

A successfully returned serialized item is restored through the authoritative transaction.

Operationally verify:

- the exact item identity was returned;
- its stock state is restored as designed;
- a stock movement exists;
- no duplicate stock item was created.

A concurrent stock conflict must stop completion and require a refreshed eligibility check.

### 6.2 SIMPLE item

A successfully returned SIMPLE quantity is restored against the relevant inventory authority.

Operationally verify:

- only the approved quantity was restored;
- previous partial returns are respected;
- stock movement reflects the returned quantity;
- the remaining returnable quantity decreases accordingly.

## 7. Refund and deduction controls

### 7.1 Full refund

A full refund returns the eligible value of the selected items, subject to current payment-source rules.

No deduction approval is required when deducted amount is zero.

### 7.2 Deducted refund

A deducted refund returns less than the eligible value.

Mandatory controls:

- reason;
- authorized role;
- actual refund evidence equal to the approved actual refund total.

### 7.3 Multiple refund channels

When multiple channels are used:

- each channel must have a positive amount;
- the total must equal the actual refund;
- source-payment limits must be respected separately and cumulatively.

## 8. Safe retry and duplicate prevention

The completion request uses a command identity and request hash.

### Safe replay

When the same command identity is sent again with materially identical content:

- the Server may return the existing result;
- no second Sale Return should be created.

### Replay conflict

When the same command identity is reused with changed material content:

- the Server rejects the request;
- the operator must not alter and reuse the old identity.

### Uncertain response procedure

If the network disconnects, the browser freezes, or the response is uncertain:

1. Do not immediately create a new return.
2. Retry using the same command identity and unchanged request where the active workflow supports it.
3. Check Sale Return history/detail for an existing completed result.
4. Refresh eligibility before making a genuinely new business attempt.

## 9. Error handling

### Sale not found in this branch

Meaning:

- the Sale does not exist in the authenticated store, or
- the user attempted cross-store access.

Action:

- verify the Sale identifier;
- verify the logged-in store;
- do not bypass branch isolation.

### Item is no longer returnable

Meaning:

- another return may already have consumed eligibility;
- quantity or item state changed.

Action:

- refresh eligibility;
- reselect items from the new projection.

### Refund exceeds eligible value

Action:

- reduce the requested refund;
- check prior returns and remaining eligibility.

### Refund evidence mismatch

Action:

- make the sum of refund channels equal the actual refund total.

### Invalid source payment

Action:

- choose payment evidence belonging to the original Sale;
- ensure remaining refundable balance is sufficient.

### Deduction reason required

Action:

- enter a meaningful free-text reason.

### Deduction approval required

Action:

- obtain an authorized OWNER, MANAGER, ADMIN, or SUPER_ADMIN.

### Stock or completion conflict

Action:

- do not repeatedly submit unchanged UI state without review;
- refresh eligibility;
- verify whether a completed return already exists;
- then retry through the canonical workflow.

## 10. Return history and detail

Use the active Sale Return history/detail views to verify completed transactions.

History and detail must remain scoped to the current store.

Review:

- return code;
- original Sale;
- employee;
- returned items;
- quantities;
- eligible, deducted, and actual refund totals;
- refund evidence;
- occurrence time;
- current status where exposed.

## 11. Compatibility boundary

The current Server mounts the Sale Return router through both canonical and compatibility namespaces. The active POS Client uses the canonical Sales-owned module.

Operational rule:

- use the active POS screens;
- do not introduce new callers to the legacy namespace;
- do not remove the compatibility namespace without repository usage and backward-compatibility evidence;
- legacy retirement is a separate implementation decision, not an automatic part of this manual.

## 12. Credit Note, tax, and accounting boundary

A completed Sale Return does not automatically prove that the following have occurred:

- Credit Note creation;
- output-tax adjustment;
- accounting journal posting;
- cash drawer or bank settlement;
- customer credit adjustment.

These capabilities require separate runtime authority and evidence. Operators must not fabricate documents or mark downstream work complete based only on the Sale Return result.

## 13. Operational checklist

Before completion:

- [ ] Current store is correct.
- [ ] Original Sale is correct.
- [ ] Eligibility is freshly loaded.
- [ ] Serialized identities are correct.
- [ ] SIMPLE quantities are within remaining eligibility.
- [ ] Refund does not exceed eligible value.
- [ ] Refund channels equal actual refund.
- [ ] Source payments belong to the Sale.
- [ ] Deduction reason is recorded where required.
- [ ] Authorized approver is present where required.

After completion:

- [ ] Sale Return identifier is recorded.
- [ ] Returned items and quantities are correct.
- [ ] Stock restoration is visible.
- [ ] Stock movement is consistent.
- [ ] Refund evidence is recorded.
- [ ] History/detail can be retrieved.
- [ ] No duplicate return was created.
- [ ] Credit Note/tax/accounting state is not assumed without separate evidence.

## 14. Acceptance boundary

This manual is complete as a repository artifact when it aligns with the Workflow Contract and Acceptance Scenarios.

The Sale Return workflow itself is not operationally accepted until:

- Human Operational Test is executed;
- actual evidence is recorded;
- final Client and Server SHAs are certified;
- review and explicit merge approval are recorded.
