# Sale Return Acceptance Scenarios

## 1. Purpose

This document defines acceptance scenarios for the authoritative Sale Return runtime. It is derived from the current Sale Return vertical slice and must not be read as evidence that Credit Note generation, tax adjustment, accounting posting, or legacy-route retirement is implemented.

## 2. Acceptance model

Each scenario records:

- preconditions;
- actor and branch context;
- command or query;
- expected authoritative result;
- evidence to capture;
- rejection or recovery boundary.

A scenario is not operationally accepted until executed against a named Client SHA, Server SHA, environment, branch, employee, and actual business record.

## 3. Scenario SR-01 — Load eligible sale in the current branch

### Preconditions

- An authenticated employee has canonical `branchId` and `employeeId`.
- A completed Sale exists in the same branch.
- At least one sold line retains returnable quantity or state.

### Action

Request Sale Return eligibility for the Sale.

### Expected result

- The Sale is found only in the authenticated branch.
- Serialized and SIMPLE lines are projected separately.
- Remaining returnable quantity and remaining refundable value are shown.
- Payment items include remaining refundable source value where applicable.

### Evidence

- request route and Sale ID;
- authenticated branch ID;
- returned serialized/SIMPLE eligibility;
- remaining quantities and refundable values.

## 4. Scenario SR-02 — Reject a Sale from another branch

### Preconditions

- The authenticated employee belongs to Branch A.
- The target Sale belongs to Branch B.

### Action

Request eligibility or attempt completion using the Branch B Sale ID.

### Expected result

- The Server does not expose the Sale.
- Eligibility returns `SALE_NOT_FOUND` or the canonical branch-isolation equivalent.
- No SaleReturn, refund evidence, stock movement, or completion-command record is created.

## 5. Scenario SR-03 — Return one serialized Stock Item

### Preconditions

- The serialized Sale Item belongs to the eligible Sale.
- The item has not already been returned.
- The current stock state allows restoration.

### Action

Submit a Sale Return command selecting the serialized Sale Item.

### Expected result

- Returned quantity is fixed to one.
- One SaleReturn item is created.
- The Stock Item is restored according to runtime policy.
- One return Stock Movement is created.
- Refund evidence matches the approved actual refund.
- Completion command authority is recorded.

### Evidence

- SaleReturn ID/code;
- Sale Item ID and Stock Item ID;
- stock state before/after;
- Stock Movement ID/type/quantity;
- refund evidence IDs and amounts;
- command ID and request hash authority.

## 6. Scenario SR-04 — Reject duplicate serialized line in one command

### Action

Submit the same serialized Sale Item more than once in the same command.

### Expected result

- Validation rejects the command as invalid or duplicated.
- No transaction mutation remains.

## 7. Scenario SR-05 — Return a partial SIMPLE quantity

### Preconditions

- A SIMPLE Sale line has remaining returnable quantity greater than the requested quantity.

### Action

Submit a return for a positive partial quantity.

### Expected result

- The requested quantity does not exceed remaining eligibility.
- Returned SIMPLE quantity is restored according to runtime stock policy.
- A SIMPLE return Stock Movement is created.
- Remaining returnable quantity decreases by the accepted quantity.
- Refund evidence equals the approved refund total.

### Evidence

- SIMPLE Sale line ID;
- quantity sold, previously returned, requested, and remaining;
- Simple Lot/Stock Balance evidence where projected by runtime;
- Stock Movement and refund evidence.

## 8. Scenario SR-06 — Reject excessive SIMPLE quantity

### Action

Submit a SIMPLE return quantity greater than remaining returnable quantity.

### Expected result

- The command is rejected by stock/eligibility policy.
- No SaleReturn, stock restoration, refund evidence, or command record remains.

## 9. Scenario SR-07 — Full refund with matching channels

### Preconditions

- Selected items have an eligible net refund value.
- Refund channels are supported by the Sale Return contract.

### Action

Submit item refund amounts and refund channel amounts whose totals exactly match the actual approved refund.

### Expected result

- The command is accepted.
- `refundEvidenceTotal` equals `actualRefundTotal` within money tolerance.
- Each source-linked refund does not exceed its remaining refundable source payment.

## 10. Scenario SR-08 — Reject refund evidence mismatch

### Action

Submit refund channels whose total differs from the actual approved refund.

### Expected result

- The command is rejected with `REFUND_EVIDENCE_MISMATCH` or canonical equivalent.
- No transaction mutation remains.

## 11. Scenario SR-09 — Reject refund above eligible value

### Action

Submit an item refund amount above the item’s remaining eligible refund.

### Expected result

- The command is rejected with `REFUND_EXCEEDS_ELIGIBLE` or canonical equivalent.
- No stock or payment mutation remains.

## 12. Scenario SR-10 — Refund linked to original source payment

### Preconditions

- The original Sale has a payment item with remaining refundable value.

### Action

Submit a refund referencing that payment item.

### Expected result

- The payment item is recognized as belonging to the original Sale.
- Requested refund from that source does not exceed its remaining refundable value.
- Refund evidence records the accepted source reference.

## 13. Scenario SR-11 — Reject foreign or exhausted source payment

### Action

Submit a refund referencing:

- a payment item from another Sale; or
- a source whose remaining refundable value is insufficient.

### Expected result

- The command is rejected with `INVALID_SOURCE_PAYMENT` or canonical equivalent.
- No transaction mutation remains.

## 14. Scenario SR-12 — Full-value return without deduction

### Action

Return eligible items with approved refund equal to the eligible refund value.

### Expected result

- Deducted amount is zero.
- No deduction approval role is required.
- Standard return reason policy applies.

## 15. Scenario SR-13 — Deducted refund with authorized approver

### Preconditions

- Actual refund is below eligible value.
- A free-text deduction reason exists.
- Actor or employee authority resolves to `OWNER`, `MANAGER`, `ADMIN`, or `SUPER_ADMIN`.

### Action

Submit the deducted refund.

### Expected result

- The deduction is accepted.
- Deducted amount and reason are recorded.
- Approval authority is attributable to the authenticated actor context.

### Evidence

- eligible amount, actual refund, and deducted amount;
- reason;
- actor role and employee authority;
- SaleReturn/refund records.

## 16. Scenario SR-14 — Reject deducted refund without reason

### Action

Submit a deducted refund with no command reason and no item reason.

### Expected result

- The command is rejected with `DEDUCTION_REASON_REQUIRED` or canonical equivalent.
- No mutation remains.

## 17. Scenario SR-15 — Reject deducted refund without approval authority

### Preconditions

- Actor and employee roles do not include an authorized deduction role.

### Action

Submit a deducted refund.

### Expected result

- The command is rejected with `DEDUCTION_APPROVAL_REQUIRED` or canonical equivalent.
- No stock, refund, or command mutation remains.

## 18. Scenario SR-16 — Atomic rollback on stock conflict

### Preconditions

- Eligibility is loaded successfully.
- Stock state changes concurrently before restoration completes.

### Action

Submit the return command.

### Expected result

- The transaction fails with `STOCK_CONFLICT` or completion conflict.
- SaleReturn header, item records, refund evidence, stock movement, and completion command do not remain partially committed.
- Operator must refresh eligibility before retry.

## 19. Scenario SR-17 — Safe replay of the same command

### Preconditions

- A return command previously completed successfully.

### Action

Resubmit the same `commandId` with materially identical sale, items, reasons, and refund evidence.

### Expected result

- The prior canonical Sale Return is returned.
- HTTP/result projection indicates replay.
- No duplicate SaleReturn, stock restoration, Stock Movement, or refund evidence is created.

### Evidence

- command ID;
- first and replayed response SaleReturn IDs;
- row/movement/refund counts before and after replay.

## 20. Scenario SR-18 — Reject command identity reused with changed material

### Action

Reuse an existing `commandId` while changing the Sale, items, quantities, reasons, refund amounts, or refund channels.

### Expected result

- The request hash conflict is rejected.
- The prior canonical result remains unchanged.
- No new mutation is created.

## 21. Scenario SR-19 — Concurrent completion race

### Action

Submit two competing completion requests against the same eligibility or command identity.

### Expected result

- At most one canonical return mutation commits.
- A valid race replay returns the canonical result.
- Otherwise the losing request receives a completion conflict and must refresh eligibility.

## 22. Scenario SR-20 — Return history list is branch-scoped

### Action

Load the Sale Return list in the authenticated branch.

### Expected result

- Only returns belonging to the current branch are projected.
- List records identify the original Sale and return state needed by the active UI.

## 23. Scenario SR-21 — Return detail projection

### Action

Open one Sale Return detail record belonging to the current branch.

### Expected result

- Header, original Sale reference, returned serialized/SIMPLE items, refund evidence, deduction information, and actor/time evidence are projected where supported.
- A foreign-branch return is not exposed.

## 24. Scenario SR-22 — Canonical Client route and API

### Action

Use the active POS routes:

- `sales/sale-return`;
- `sales/sale-return/create/:saleId`.

### Expected result

- Runtime pages come from `src/features/sales/return`.
- Eligibility uses `/sales/returns/eligible/:saleId`.
- Completion uses `/sales/returns/complete`.
- The active UI does not depend on the legacy top-level feature for its primary workflow.

## 25. Scenario SR-23 — Compatibility route remains non-authoritative

### Action

Assess legacy callers using `/sale-returns/...` or `/sales/returns/create`.

### Expected result

- Compatibility paths may delegate to the same canonical Server router.
- Their presence does not make the legacy Client feature the runtime owner.
- No compatibility path is removed without separate usage and backward-compatibility evidence.

## 26. Scenario SR-24 — Credit Note boundary

### Action

Complete a Sale Return and inspect the canonical result and persisted records.

### Expected result

- Acceptance does not claim that a Credit Note was generated unless runtime evidence explicitly shows it.
- Missing Credit Note behavior is recorded as a downstream integration boundary, not silently inferred.

## 27. Scenario SR-25 — Tax adjustment boundary

### Action

Complete a Sale Return and inspect tax-related records or publication results.

### Expected result

- Acceptance does not claim tax adjustment, output-tax reversal, or filing-period mutation without explicit runtime evidence.
- Any required tax integration is recorded as a separate downstream workflow or gap.

## 28. Human operational acceptance record

For operational acceptance, record at minimum:

- Client SHA;
- Server SHA;
- environment;
- branch and employee;
- original Sale IDs;
- SaleReturn IDs/codes;
- serialized and SIMPLE evidence;
- stock states and movement IDs;
- refund source/evidence IDs;
- deduction and approval evidence;
- replay/conflict evidence;
- history/detail evidence;
- PASS/FAIL/BLOCKED per scenario;
- defects and unresolved downstream boundaries.

## 29. Acceptance boundary

Repository documentation and later CI checks are necessary but insufficient. Sale Return remains `IN PROGRESS` until Human Operational Test evidence and an explicit merge decision are recorded.
