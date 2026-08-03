# ProductTemplate Candidate Promotion Slice 3

## Goal

Implement the next deterministic backend workflow using the existing Prisma contract:

- `UNDER_REVIEW -> PROMOTED` when a new Template Product is created in the SYSTEM TEMPLATE branch.
- `UNDER_REVIEW -> MERGED` when the candidate is linked to an existing Template Product.

There is no `APPROVED` status or event in the current schema. This slice must not invent one.

## Source authority

- Base branch: `feature/product-template-candidate-review-slice-2`
- Base SHA: `dcc57020699d0c72403c04e6d1a39fe26866f4df`
- Review Slice 2 targeted contract: PASS

## Runtime authority

The current ProductTemplate runtime treats Template Products as `Product` rows governed by the SYSTEM TEMPLATE branch (`branchCode = T01`). Promotion must use the canonical Product/ProductTemplate repository semantics rather than introduce a second template model.

## HTTP surface

- `POST /api/product-templates/candidates/:id/promote`
- `POST /api/product-templates/candidates/:id/merge`

## Promote contract

1. SUPERADMIN only.
2. Candidate must exist and be `UNDER_REVIEW`.
3. Target branch must still be the approved SYSTEM TEMPLATE branch.
4. Server derives a strict allowlisted template payload from `proposedTemplateData` when present, otherwise from `sourceSnapshot`.
5. No price, cost, stock, serial, supplier, customer, sale, purchase, tax, repair, claim, reservation, media, or physical-asset data may be copied.
6. Create one new Template Product in the target Template Branch.
7. Set Candidate `targetTemplateProductId`, `status = PROMOTED`, `reviewedByEmployeeId`, `reviewedAt`, `promotedAt`, and optional decision note.
8. Append one `PROMOTED` event.
9. Template Product creation, Candidate transition, and event append must be atomic.
10. Concurrent/repeated Promote must not create duplicate Template Products.

## Merge contract

1. SUPERADMIN only.
2. Candidate must exist and be `UNDER_REVIEW`.
3. Caller supplies explicit `targetTemplateProductId`.
4. Target Product must belong to the Candidate target SYSTEM TEMPLATE branch.
5. Source Product and target Template Product remain distinct records.
6. No target Product mutation is permitted in this slice.
7. Set Candidate `targetTemplateProductId`, `status = MERGED`, reviewer fields, and decision note.
8. Append one `MERGED` event.
9. Candidate transition and event append must be atomic.
10. Concurrent/repeated Merge must not create duplicate events or alter another target.

## Responsibility structure

```text
src/modules/productTemplate/candidates/promotion/
  shared/
  promote/
    promoteProductTemplateCandidateController.js
    promoteProductTemplateCandidateService.js
    promoteProductTemplateCandidateRepository.js
  merge/
    mergeProductTemplateCandidateController.js
    mergeProductTemplateCandidateService.js
    mergeProductTemplateCandidateRepository.js
```

## Locked safety rules

- No Prisma or migration changes.
- No invented `APPROVED` status/event.
- No source Product mutation.
- No Brand, ProductType, Unit, BranchPrice, StockItem, ProductImage, or transaction copy/create outside the minimum Template Product relation requirements.
- No price snapshot creation during promotion.
- No media or physical asset copy.
- No Product/Brand ownership backfill.
- No merge of tenant operational data.
- The two active stores remain independent tenants.
- Commands use conditional transition guards and deterministic conflicts.

## Stop conditions

Stop `BLOCKED` rather than invent behavior if:

- the existing Product create contract requires fields that cannot be safely derived from catalog-safe Candidate data;
- creating a Template Product necessarily mutates price, stock, media, or operational data;
- ProductType/Brand/Unit ownership for the Template branch cannot be resolved without a new migration or unsafe copy;
- transaction composition cannot guarantee one Template Product per successful Promote.

## Verification

- Pure payload allowlist tests.
- Route/SUPERADMIN boundary tests.
- Promote atomicity and conditional transition contract.
- Merge target-template ownership contract.
- Event semantics for `PROMOTED` and `MERGED`.
- Repeated/concurrent command guards.
- Static proof that forbidden operational fields and repositories are absent.

## Merge/deploy

Keep Draft. No merge or deploy until exact-SHA targeted tests and controlled runtime evidence pass.
