# Sale Return Workflow Contract

## 1. Workflow Identity

- Workflow: Sale Return
- Owning domain: `sales/return`
- Canonical Server route family: `/api/sales/returns/...`
- Canonical Client owner: `src/features/sales/return`
- Explicitly separate from Core Sale Completion

This Contract covers eligibility lookup, return selection, refund/deduction validation, approval, stock restoration, refund evidence, idempotency, and return history.

Credit Note generation, tax adjustment, accounting posting, and cash-disbursement execution are not claimed unless separately supported by runtime authority.

## 2. Actors and Authority

- Sales employee: searches the original Sale, selects returnable lines, supplies refund evidence, and submits the return.
- Authorized approver: OWNER, MANAGER, ADMIN, or SUPER_ADMIN when the actual refund is lower than the eligible amount.
- Authenticated Server context: owns canonical `branchId`, `employeeId`, and actor role.
- System: validates eligibility, remaining quantity/value, payment-source authority, approval, stock mutation, refund evidence, idempotency, and branch isolation.

No request may select a Sale, Sale Item, SIMPLE line, payment source, or return record from another branch.

## 3. Trigger

The workflow begins when an authenticated employee selects an original Sale and requests its current return eligibility.

## 4. Preconditions

1. A valid authenticated branch and employee context exist.
2. The original Sale exists in the current branch.
3. At least one line remains returnable.
4. Every requested line identity is unique.
5. A serialized line references an eligible original `saleItemId` and returns quantity one.
6. A SIMPLE line references an eligible original `saleItemSimpleId` and requests a positive quantity not exceeding the remaining returnable quantity.
7. Each requested refund amount does not exceed the original line's remaining eligible net value.
8. Refund channels equal the actual approved refund total.
9. A referenced source payment belongs to the original Sale and retains sufficient refundable balance.
10. Any deducted refund has a free-text reason and an authorized approver.
11. A stable command identity is supplied for idempotent completion.

## 5. Inputs

### Return header

- `commandId`
- `saleId`
- free-text `reason`

### Return items

Serialized:

- `kind = SERIALIZED`
- `saleItemId`
- quantity fixed to one
- requested refund amount
- optional line reason

SIMPLE:

- `kind = SIMPLE`
- `saleItemSimpleId`
- positive return quantity
- requested refund amount
- optional line reason

### Refund evidence

Supported methods are defined by the runtime `SALE_RETURN_REFUND_METHOD` contract.

Each refund entry may include:

- method
- amount
- optional original `sourcePaymentItemId`
- reference number
- note

## 6. Eligibility Path

```text
Select original Sale
→ GET /api/sales/returns/eligible/:saleId
→ verify current branch ownership
→ load original serialized and SIMPLE lines
→ subtract prior returned quantities and values
→ load original payment items and remaining refundable amounts
→ return current eligibility projection
```

Eligibility is a point-in-time projection. Completion revalidates the same authority inside the transaction.

## 7. Completion Path

```text
Prepare return command
→ submit stable commandId
→ check safe replay
→ start transaction
→ reload branch-scoped eligibility
→ validate serialized and SIMPLE selections
→ calculate eligible total, actual refund, and deduction
→ validate refund channels and source payments
→ verify deduction reason and approver authority when required
→ create Sale Return header
→ restore serialized and SIMPLE stock
→ create stock movements
→ create refund evidence
→ create completion-command authority
→ commit transaction
→ return canonical Sale Return result
```

A failure inside the transaction must not leave partial stock restoration, refund evidence, or completion-command records.

## 8. Serialized Return Rules

- The original serialized Sale Item must remain returnable.
- Quantity is exactly one.
- The same serialized line cannot be selected twice in one command.
- Completion restores the Stock Item according to the Sale Return stock policy.
- A concurrent stock change causes `STOCK_CONFLICT` or completion conflict.
- Employees must reload eligibility before a deliberate retry after conflict.

## 9. SIMPLE Return Rules

- The original SIMPLE line must remain returnable.
- Return quantity must be positive and no greater than the remaining eligible quantity.
- The same SIMPLE line cannot be selected twice in one command.
- Completion restores the appropriate SIMPLE inventory authority and creates a return movement.
- Concurrent quantity changes require eligibility refresh and retry.

## 10. Refund and Deduction Contract

Definitions:

- Eligible refund: remaining original net value of the selected items.
- Actual refund: total value approved to return to the customer.
- Deducted amount: eligible refund minus actual refund.

Rules:

- Actual refund cannot exceed eligible refund.
- Refund evidence total must equal actual refund.
- A refund tied to an original payment source cannot exceed that source's remaining refundable balance.
- The source payment must belong to the original Sale.
- A positive deduction requires a free-text reason.
- A positive deduction requires OWNER, MANAGER, ADMIN, or SUPER_ADMIN authority.

This workflow records refund evidence. It does not claim that every refund method performs an external bank/card/cash disbursement automatically.

## 11. Idempotency and Retry

- Completion requires a stable `commandId`.
- Material return data is hashed.
- Same command identity plus identical material returns the prior canonical result.
- Same command identity plus changed material is an idempotency conflict.
- After an uncertain response, retry only the identical unchanged command with the same identity.
- After changing items, quantities, refund amounts, sources, or reason, create a new business command identity.

## 12. Concurrency

The workflow detects races involving:

- prior return consumption;
- stock restoration;
- refund-source balance;
- completion-command uniqueness.

Known Prisma transaction/uniqueness races are projected as a completion conflict. Required recovery is to reload eligibility and verify whether the return already exists before retrying.

## 13. Outputs

Successful completion produces a canonical result containing, as supported by the mapper/runtime:

- Sale Return ID and code;
- original Sale reference;
- returned serialized and SIMPLE items;
- eligible, refunded, and deducted totals;
- refund evidence;
- employee/branch authority;
- idempotency replay state;
- timestamps and return status.

## 14. History and Detail

Canonical Server paths include:

- `GET /api/sales/returns`
- `GET /api/sales/returns/:id`

List and detail must remain branch-scoped.

Employees use history/detail to:

- verify whether an uncertain submission already completed;
- review returned items and quantities;
- review refund and deduction evidence;
- inspect the original Sale reference;
- avoid duplicate returns.

## 15. Compatibility Boundary

Canonical path:

- `/api/sales/returns/...`

Compatibility paths currently retained:

- `/api/sales/returns/create`
- router mount under `/api/sale-returns/...`

Compatibility paths do not redefine domain authority. They route to the same Sale Return module and remain only for backward compatibility.

No compatibility path may be removed under this DDWD Increment without separate usage evidence and approval.

## 16. Downstream Document, Tax, and Accounting Boundary

Runtime discovery for this Contract does not prove that Sale Return completion automatically creates:

- Credit Note;
- output-tax adjustment;
- accounting journal entries;
- external payment-provider refund;
- cash disbursement transaction.

Operational guidance must describe these as separate downstream workflows unless later source evidence proves direct integration.

The completed Sale Return remains the authority for returned items, restored stock, and refund evidence recorded by this module.

## 17. Exceptions and Recovery

| Condition | Required response |
|---|---|
| Original Sale not found in current branch | Verify branch and Sale identifier |
| No remaining eligible quantity/value | Do not create another return |
| Duplicate requested line | Remove duplicate selection |
| Requested SIMPLE quantity exceeds remaining | Reload eligibility and reduce quantity |
| Refund exceeds eligible value | Correct requested refund |
| Refund evidence does not equal actual refund | Reconcile refund channels |
| Invalid source payment | Select a payment from the original Sale with remaining refundable balance |
| Deduction reason missing | Enter a clear business reason |
| Deduction approval required | Obtain an authorized role |
| Stock/completion conflict | Reload eligibility and history before retry |
| Timeout/uncertain response | Search return history; retry identical command only when needed |
| Same command identity with changed data | Use a new identity for the changed business action |

## 18. Acceptance Boundary

This Contract documents repository behavior; it does not by itself prove operational acceptance.

Acceptance still requires:

- Client operational guide and in-app guidance;
- acceptance scenarios;
- focused verification and final build/certification on final SHAs;
- Human Operational Test covering serialized and SIMPLE returns, refund evidence, deduction approval, conflict recovery, and history;
- explicit human merge decision.
