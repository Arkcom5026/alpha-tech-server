# Core Sales Operational Evidence Record

## Status

- Record state: `UNEXECUTED`
- Overall result: `PENDING`
- This file is a recording template. Its existence is not operational evidence.

## 1. Execution identity

- Client certified SHA:
- Server certified SHA:
- Environment:
- Branch/Store ID:
- Operator:
- Observer/reviewer:
- Started at:
- Completed at:
- Evidence location:

## 2. Authorization and safety

- [ ] Test data and environment were authorized.
- [ ] Production business records were not mutated without explicit approval.
- [ ] Cross-store negative tests used authorized identifiers only.
- [ ] Failed or uncertain submissions were checked in Sale History before retry.
- [ ] No duplicate Sale was created to recover Tax Candidate publication.

## 3. Contextual Help evidence

- Help button visible:
- Drawer opens/closes:
- Required topics present:
- Screenshot/recording:
- Result: PASS / FAIL / BLOCKED
- Notes:

## 4. Structured Stock evidence

- Stock Item ID:
- Product ID:
- Barcode/Serial:
- Branch ID:
- Status before:
- Status after:
- Sale ID:
- Stock Movement ID:
- Result: PASS / FAIL / N/A
- Notes:

## 5. Tracked SIMPLE evidence

- Product ID:
- Simple Lot ID:
- Stock Balance ID:
- Quantity sold:
- Lot quantity before/after:
- Balance quantity before/after:
- Sale ID:
- Stock Movement ID:
- Result: PASS / FAIL / N/A
- Notes:

## 6. NON_STOCK evidence

- Product ID:
- Quantity:
- Stock Balance before/after:
- Sale ID:
- Result: PASS / FAIL / N/A
- Notes:

## 7. Held Cart evidence

- Held Cart ID/Code:
- Version loaded:
- Revalidation result:
- Price-change evidence:
- Availability evidence:
- Status before: `OPEN`
- Status after:
- Converted Sale ID:
- Result: PASS / FAIL / N/A
- Notes:

## 8. CASH completion evidence

- Command ID:
- Sale ID/Code:
- Customer ID if any:
- Total before discount:
- Discount:
- VAT:
- Net total:
- Payment IDs:
- Payment methods/amounts:
- Payment status:
- Completion status:
- Default document:
- Result: PASS / FAIL / N/A
- Notes:

## 9. CREDIT completion evidence

- Command ID:
- Sale ID/Code:
- Customer ID:
- Payment terms:
- Due date:
- Paid amount:
- Outstanding amount:
- Payment status:
- Completion status:
- Default document:
- Result: PASS / FAIL / N/A
- Notes:

## 10. Payment rejection evidence

| Scenario | Error code/message | No Sale mutation | No Stock mutation | No Deposit mutation | Result |
|---|---|---:|---:|---:|---|
| CASH shortfall | | | | | |
| Payment exceeds total | | | | | |
| CREDIT with immediate payment | | | | | |
| Deposit ID missing | | | | | |
| Cross-customer/branch deposit | | | | | |

## 11. Idempotency evidence

- Command ID:
- Request hash/fingerprint if available:
- First response Sale ID:
- Retry response Sale ID:
- Sale count before/after:
- Payment count before/after:
- Stock Movement count before/after:
- Deposit Usage count before/after:
- Changed-payload conflict evidence:
- Result: PASS / FAIL / N/A
- Notes:

## 12. Tax publication evidence

- Sale ID:
- Sale committed successfully:
- Tax intake status: `REGISTERED` / `REPLAYED` / `SKIPPED` / `PENDING_RETRY`
- Tax Candidate ID:
- Tax Document ID:
- If `PENDING_RETRY`, Sale remained searchable:
- No duplicate Sale created:
- Retry/Reconciliation path used:
- Result: PASS / FAIL / N/A
- Notes:

## 13. History and printable evidence

- Search parameters:
- Sale ID/Code found:
- Structured items present:
- SIMPLE items present:
- Payments present:
- Totals and balance correct:
- Receipt/Delivery Note opened:
- Cancelled sale excluded where applicable:
- Result: PASS / FAIL / N/A
- Notes:

## 14. Branch isolation evidence

| Authority | Current-branch access | Cross-branch rejection | Evidence | Result |
|---|---:|---:|---|---|
| Stock Item | | | | |
| Simple Lot / Balance | | | | |
| Held Cart | | | | |
| Customer Deposit | | | | |
| Sale Detail | | | | |
| Printable Search | | | | |

## 15. Defects and recovery

| Defect ID | Severity | Scenario | Observed behavior | Expected behavior | Evidence | Resolution status |
|---|---|---|---|---|---|---|
| | | | | | | |

## 16. Final decision

- Repository certification: PASS / FAIL
- Client build and focused contract: PASS / FAIL
- Human Operational Test: PASS / FAIL / BLOCKED
- Independent Human Review: PASS / FAIL / BLOCKED
- Merge recommendation: READY / HOLD

Blocking reasons:

1.
2.
3.

Operator confirmation:

- Name:
- Date/time:
- Confirmation note:

Reviewer confirmation:

- Name/GitHub username:
- Date/time:
- Decision:
- Review note:
