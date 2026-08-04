# ProductTemplate Candidate Review Slice 2

## Goal

Add the next deterministic backend workflow after Candidate creation and query:

`DRAFT -> UNDER_REVIEW -> REJECTED`

Promotion and merge are intentionally excluded from this slice until review ownership, transition guards, idempotency, and audit are proven.

## Source authority

- Base branch: `feature/product-template-candidate-runtime-slice-1`
- Base SHA: `f877fc78d324814b00bbe098c61d2e6dc28acad6`
- Slice 1 targeted contract evidence: PASS

## Required HTTP surface

- `POST /api/product-templates/candidates/:id/start-review`
- `POST /api/product-templates/candidates/:id/reject`

Both endpoints are authenticated and SUPERADMIN-only.

## Locked state transitions

### Start review

- Allowed only from `DRAFT`.
- Resulting status: `UNDER_REVIEW`.
- Set `reviewedByEmployeeId` from authenticated EmployeeProfile authority.
- Set `reviewedAt` using server time.
- Append `REVIEW_STARTED` event in the same transaction.
- Repeating the same command after success must return deterministic conflict; it must not append another event.

### Reject

- Allowed only from `UNDER_REVIEW`.
- Resulting status: `REJECTED`.
- Require a trimmed, non-empty decision note.
- Preserve the review actor already assigned; the rejecting actor must be recorded in the event.
- Store the final `decisionNote` on Candidate.
- Append `REJECTED` event in the same transaction.
- Repeating the same command after success must return deterministic conflict; it must not append another event.

## Concurrency and write safety

- Use a conditional candidate update (`id + expected status`) inside one Prisma transaction.
- A zero-row conditional update is a state conflict, not a retryable success.
- Event creation occurs only after the conditional update succeeds.
- No last-write-wins status overwrite.
- No Candidate hard delete.
- No Product, Brand, BranchPrice, StockItem, ProductTemplate, or source Product mutation.

## Responsibility structure

```text
src/modules/productTemplate/candidates/
  review/start/
    startProductTemplateCandidateReviewController.js
    startProductTemplateCandidateReviewService.js
    startProductTemplateCandidateReviewRepository.js
  review/reject/
    rejectProductTemplateCandidateController.js
    rejectProductTemplateCandidateService.js
    rejectProductTemplateCandidateRepository.js
```

Existing route composition remains module-owned.

## Out of scope

- Prisma or migration changes
- Proposed data editing
- Duplicate classifier
- Approve, Promote, Merge, Cancel
- ProductTemplate or target Product creation
- Physical asset/media copy
- Product/Brand ownership backfill
- Frontend
- Application deploy or merge

## Verification

- Pure transition-policy tests.
- Repository contract proving conditional update and append-only event share one transaction.
- Route contract proving SUPERADMIN-only endpoints.
- Deterministic conflict codes for invalid/repeated transitions.
- Existing Slice 1 contract remains PASS.

## Merge/deploy

Keep Draft. No merge or deploy until exact-SHA targeted tests pass.
