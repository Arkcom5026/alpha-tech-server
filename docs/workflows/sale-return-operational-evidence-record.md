# Sale Return Operational Evidence Record

## Record Status

`UNEXECUTED`

This file is an evidence template only. Its existence does not mean the Sale Return workflow has passed Human Operational Test, Runtime Certification, production verification, accounting verification, or tax verification.

Do not change the status to `EXECUTED` until actual tests are performed against identified Client and Server SHAs in a known environment.

## Purpose

Record evidence from the Sale Return Human Operational Test Pack and preserve the authority chain between:

- tested Client SHA;
- tested Server SHA;
- authenticated shop/branch;
- operator and approval roles;
- original Sale;
- Sale Return result;
- stock restoration;
- refund evidence;
- idempotency/recovery behavior;
- downstream Credit Note and tax boundaries.

## Authority References

- Workflow Contract: `docs/workflows/sale-return-workflow-contract.md`
- Acceptance Scenarios: `docs/workflows/sale-return-acceptance-scenarios.md`
- Business Operation Manual: `docs/workflows/sale-return-business-operation-manual.md`
- Client User Guide: companion Client PR
- Human Operational Test Pack: companion Client PR
- Canonical Server route: `/api/sales/returns/...`
- Canonical Client owner: `src/features/sales/return`

## Test Identity

- Execution date/time:
- Tester:
- Evidence reviewer:
- Environment:
- Environment URL:
- Browser/device:
- Client repository:
- Client branch:
- Client SHA:
- Server repository:
- Server branch:
- Server SHA:
- Database/environment identifier:
- Shop/branch ID:
- Shop/branch name:
- Operator employee ID:
- Operator role:
- Deduction approver employee ID/role, if used:

## Source Business Records

Record each original Sale used during testing.

| Purpose | Sale ID | Sale code | Customer | Shop/branch | Payment evidence | Items | Pre-test return state |
|---|---:|---|---|---|---|---|---|
| Serialized return | | | | | | | |
| SIMPLE partial return | | | | | | | |
| Deducted refund | | | | | | | |
| Idempotency/recovery | | | | | | | |
| Cross-shop isolation | | | | | | | |

## Scenario Results

Use `PASS`, `FAIL`, or `BLOCKED` only.

| # | Scenario | Result | Evidence reference | Notes / defect |
|---:|---|---|---|---|
| 1 | Open Sale Return Search and Help | | | |
| 2 | Search by Sale code | | | |
| 3 | Search by customer name/phone | | | |
| 4 | Cross-shop isolation | | | |
| 5 | Load eligibility and Help | | | |
| 6 | Return serialized item | | | |
| 7 | Partial SIMPLE quantity return | | | |
| 8 | Reject excess SIMPLE quantity | | | |
| 9 | Refund channels equal actual refund | | | |
| 10 | Reject refund evidence mismatch | | | |
| 11 | Source payment validation | | | |
| 12 | Reject foreign/exhausted payment source | | | |
| 13 | Full refund without deduction approval | | | |
| 14 | Deducted refund with authorized role | | | |
| 15 | Reject deduction without reason | | | |
| 16 | Reject deduction without approval authority | | | |
| 17 | Idempotent safe retry | | | |
| 18 | Reject changed payload with same command identity | | | |
| 19 | Uncertain response recovery | | | |
| 20 | Stock/concurrency conflict | | | |
| 21 | History and detail | | | |
| 22 | Original Sale preservation | | | |
| 23 | Compatibility boundary | | | |
| 24 | Credit Note boundary | | | |
| 25 | Tax adjustment boundary | | | |

## Core Runtime Evidence

### Eligibility

- Request ID/log reference:
- Sale ID/code:
- Authenticated branch ID:
- Serialized eligible items:
- SIMPLE eligible lines and quantities:
- Prior-return amounts/quantities reflected:
- Evidence attachment/reference:

### Successful Serialized Return

- Sale Return ID:
- Sale Return code:
- Original Sale ID/code:
- Returned Sale Item ID:
- Stock Item ID/serial/barcode:
- Before state:
- After state:
- Stock Movement ID/reference:
- Refund Evidence IDs:
- Completion Command ID:
- HTTP/result status:
- Evidence attachment/reference:

### Successful SIMPLE Partial Return

- Sale Return ID/code:
- Original Sale ID/code:
- Sale Item Simple ID:
- Product/Simple Lot ID where applicable:
- Eligible quantity before:
- Returned quantity:
- Remaining eligible quantity after:
- Stock balance before:
- Stock balance after:
- Stock Movement ID/reference:
- Refund Evidence IDs:
- Completion Command ID:
- Evidence attachment/reference:

### Deducted Refund

- Original eligible value:
- Actual refund:
- Deducted amount:
- Overall/line reason:
- Operator role:
- Employee authority role:
- Approval outcome:
- Sale Return ID/code:
- Evidence attachment/reference:

### Refund Source Evidence

| Refund method | Amount | Source Payment Item ID | Original payment method/amount | Remaining refundable before | Result |
|---|---:|---:|---|---:|---|
| | | | | | |

### Idempotency and Recovery

- Command ID:
- Initial request hash/reference:
- Initial outcome:
- Retry outcome:
- Replayed flag/result:
- Duplicate Sale Return count observed:
- Duplicate stock movements observed:
- Duplicate refund evidence observed:
- Changed-payload conflict result:
- Evidence attachment/reference:

### Transaction Rollback / Conflict

- Conflict type:
- Request ID/log reference:
- Error code/message:
- Sale Return committed?:
- Stock changed?:
- Refund evidence created?:
- Completion command created?:
- Eligibility refresh result:
- Evidence attachment/reference:

## Branch Isolation Evidence

- Current authenticated branch:
- Foreign Sale branch:
- Foreign Sale search result:
- Direct eligibility request result:
- Return completion attempt result, if safely tested:
- Data exposure observed:
- Evidence attachment/reference:

Expected authority result: no Sale, eligibility, return, stock, payment, or history data from an unrelated branch is exposed or mutated.

## History and Traceability Evidence

- Sale Return list entry visible:
- Detail entry visible:
- Original Sale link/reference:
- Returned lines and quantities:
- Refund/deduction projection:
- Employee/operator:
- Branch:
- Created timestamp:
- Original Sale retained:
- Evidence attachment/reference:

## Compatibility Boundary Evidence

- Canonical UI used:
- Canonical API requests observed:
- Any active runtime request to `/api/sale-returns/...` observed:
- Legacy Client feature observed in mounted router:
- Compatibility dependency found:
- Retirement recommendation:

Compatibility paths must not be removed from this evidence alone unless all supported consumers and backward-compatibility obligations are separately verified.

## Credit Note Boundary

- Credit Note runtime record generated:
- Credit Note document generated:
- Identifier/reference:
- Verified by:
- Evidence:

Choose one conclusion:

- [ ] `IMPLEMENTED AND VERIFIED`
- [ ] `NOT IMPLEMENTED / NO RUNTIME EVIDENCE`
- [ ] `BLOCKED`

Do not select `IMPLEMENTED AND VERIFIED` based only on Sale Return completion, documentation, expectation, or accounting convention.

## Tax Adjustment Boundary

- Tax adjustment/candidate generated:
- Tax record identifier:
- Coupled to return transaction or downstream:
- Failure/retry behavior:
- Verified by:
- Evidence:

Choose one conclusion:

- [ ] `IMPLEMENTED AND VERIFIED`
- [ ] `NOT IMPLEMENTED / NO RUNTIME EVIDENCE`
- [ ] `BLOCKED`

Do not create a duplicate Sale Return to compensate for a downstream tax failure or missing tax projection.

## Defect Register

| ID | Severity | Scenario | Description | Reproduction | Owner | State | Resolution evidence |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## Final Counts

- Total scenarios: 25
- PASS:
- FAIL:
- BLOCKED:
- Critical defects:
- High defects:
- Medium defects:
- Low defects:

## Operational Acceptance Decision

Choose one:

- [ ] `ACCEPTED` — all blocking scenarios pass and evidence is complete.
- [ ] `REJECTED` — blocking defects remain.
- [ ] `BLOCKED` — required environment, role, data, or dependency is unavailable.
- [x] `UNEXECUTED` — testing has not yet occurred.

## Sign-Off

- Tester:
- Operational owner:
- Reviewer:
- Date/time:
- Explicit merge authorization recorded separately: Yes / No

## Evidence Integrity Rules

1. Never fill fields with assumed values.
2. Never copy CI success into Human Operational Test results.
3. Never treat repository review as proof of stock, refund, database, tax, or accounting behavior.
4. Certified SHAs must match the runtime actually tested.
5. Evidence from another shop/branch cannot substitute for current-branch isolation verification.
6. Screenshots, logs, request IDs, database references, and generated document identifiers should be linked where available.
7. Any code change after execution invalidates SHA-bound acceptance until impact is assessed and affected scenarios are repeated.
