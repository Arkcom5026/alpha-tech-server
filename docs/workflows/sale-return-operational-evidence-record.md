# Sale Return Operational Evidence Record

## Record Status

`UNEXECUTED`

This file records repository and certification evidence while preserving Human Operational Test as a separate evidence class. Its existence does not mean the Sale Return workflow has passed Human Operational Test, production verification, accounting verification, or tax verification.

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
- Client User Guide: merged Client PR #51
- Human Operational Test Pack: merged Client PR #51
- Canonical Server route: `/api/sales/returns/...`
- Canonical Client owner: `src/features/sales/return`

## Verified Client Repository Evidence

This section records repository-level verification only. It is not Human Operational Test, Server runtime evidence, production verification, or operational acceptance.

- Client repository: `Arkcom5026/alpha-tech-client`
- Client PR: `#51`
- Verified Client PR head SHA: `ab14ff4f29208aea050369fac30c5d82d920f322`
- Client merge commit: `bc8c4d621051f1135a4545da210ae27682daa974`
- Workflow: `Frontend Mission Control v2`
- Workflow run ID: `30673684217`
- Workflow run number: `1076`
- Workflow conclusion: `SUCCESS`
- Verified focused command: `npm run test:sale-return-help`
- Focused result: `6 tests passed`
- Additional successful steps:
  - Repair Help contract
  - Warranty Claim Help contract
  - Quick Receipt Help contract
  - secret injection
  - Production Build
- Verification review ID on Client PR: `4832889603`

Repository evidence conclusion: the Sale Return Client help contract and Production Build completed successfully for the identified Client SHA.

## Merge Evidence

- Client PR #51: `MERGED`
- Client merge commit: `bc8c4d621051f1135a4545da210ae27682daa974`
- Server PR #211: `MERGED`
- Server merge commit: `75db731cf63dcf93443c83ff60e534f2a023a8a1`
- Explicit human merge authorization: recorded in the working conversation before merge

## Final ALDE Certification Evidence

This section records merged-source certification only. It does not replace Human Operational Test or production business evidence.

- Workflow: `ALDE Local Certification`
- Workflow run ID: `30676041877`
- Source branch: `main`
- Source SHA / certified Client head: `52f5bf548803989a816ffa300c9d992ee11b8c65`
- Certified Server head: `75db731cf63dcf93443c83ff60e534f2a023a8a1`
- Mode: `SyncAndCertify`
- Runner: `ALDE-WIN01`
- Runner OS/architecture: `Windows / X64`
- Started at: `2026-08-01T00:40:46.6112875Z`
- Finished at: `2026-08-01T00:42:49.2201961Z`
- Result Bridge published at: `2026-08-01T00:42:58.3769185Z`
- Result: `PASS`
- Engine exit code: `0`
- Pipeline exit code: `0`
- Failed gate count: `0`
- Regression count: `0`
- Environment blocker count: `0`
- Safety guard count: `0`
- Unclassified failure count: `0`
- Authority interpretation: `All certification gates passed.`
- Direct Partner Store runtime write verifier: intentionally `SKIP`
- Dedicated Partner Store Test DB runtime verifier: `PASS`

Certification conclusion: merged Client and Server source completed ALDE `SyncAndCertify` successfully. Human Operational Test and production business evidence remain unexecuted.

## Test Identity

- Execution date/time:
- Tester:
- Evidence reviewer:
- Environment:
- Environment URL:
- Browser/device:
- Client repository: `Arkcom5026/alpha-tech-client`
- Client branch: `main`
- Client SHA to use for Human Operational Test: `52f5bf548803989a816ffa300c9d992ee11b8c65`
- Client Sale Return merge commit: `bc8c4d621051f1135a4545da210ae27682daa974`
- Server repository: `Arkcom5026/alpha-tech-server`
- Server branch: `main`
- Server SHA to use for Human Operational Test: `75db731cf63dcf93443c83ff60e534f2a023a8a1`
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
- Explicit merge authorization recorded separately: Yes

## Evidence Integrity Rules

1. Never fill fields with assumed values.
2. Never copy CI or ALDE success into Human Operational Test results.
3. Never treat repository review as proof of stock, refund, database, tax, or accounting behavior.
4. Certified SHAs must match the runtime actually tested.
5. Evidence from another shop/branch cannot substitute for current-branch isolation verification.
6. Screenshots, logs, request IDs, database references, and generated document identifiers should be linked where available.
7. Any code change after execution invalidates SHA-bound acceptance until impact is assessed and affected scenarios are repeated.
