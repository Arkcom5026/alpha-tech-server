# Position-first Residual Archaeology — 2026-08-22

## Purpose

This audit maps live residual authority after Wave 3K so remaining work can be executed in larger batches rather than endpoint-by-endpoint.

## A. Live residuals included in Batch 4

### Communication

Evidence before Batch 4:
- communication policy derived management authority from `employeeRole` / `v2Role`
- ordinary employee context controlled broad operational access

Disposition: MIGRATE NOW.

### Store Experience

Evidence before Batch 4:
- draft and media routes used local role/profile checks instead of the Position capability resolver
- any employee profile historically had broad management/publish access

Disposition: MIGRATE NOW while preserving legacy employee compatibility and allowing migrated Positions to split read/manage/publish.

### Product Trace

Evidence before Batch 4:
- financial visibility depended directly on OWNER/MANAGER `v2Role`
- trace read itself was broad authenticated/branch behavior

Disposition: MIGRATE NOW with separate read and financial capabilities.

### Legacy `/api/employees` mutations

Evidence before Batch 4:
- canonical onboarding already used `employee.manage`
- older create route accepted any platform `EMPLOYEE` account category via service-level staff-role checking
- older update/status mutations were branch-scoped but had no explicit employee-management capability

Disposition: ALIGN NOW to existing `employee.manage`; keep employee reads unchanged and hard-delete disabled.

## B. Live residual that requires its own complete subgroup

### Product Pricing

Current policy still owns a direct role matrix:
- OWNER may mutate cost and selling prices
- MANAGER may mutate selling prices but not cost
- ADMIN/SUPERADMIN may mutate all price fields

The policy is consumed across branch pricing, product creation, maintenance, Quick Stock, Quick Receipt, product cloning, reverse/template cloning and template-price snapshots. Several callers currently pass reduced actor objects that omit `positionCapabilities`.

Disposition: MUST MIGRATE, but only as one actor-continuity batch. Do not patch the policy alone.

Proposed capability shape for the next pricing batch, subject to final caller archaeology:
- `product.pricing.manage`
- `product.cost.manage`

Compatibility target:
- OWNER => both
- MANAGER => pricing only
- CASHIER/TECHNICIAN => neither
- ADMIN/SUPERADMIN => both
- migrated Position arrays authoritative including `[]`

## C. Platform/global governance — do not convert merely because `requireAdmin` remains

### Branch mutation

Branch create/update/delete changes tenant boundaries.
Disposition: KEEP PLATFORM ADMIN.

### Category mutation

Category is shared/global taxonomy and includes system-category / GlobalProductType reference constraints.
Disposition: KEEP PLATFORM ADMIN pending a separate catalog-governance decision.

### Product Template mutation

Template catalog is a central/template-branch governance surface and also participates in price snapshots.
Disposition: KEEP PLATFORM ADMIN for route governance; pricing internals may still need Position-aware actor continuity where applicable.

### Product Profile

Runtime surface is retired and returns HTTP 410.
Disposition: LEAVE RETIRED; no Position capability needed.

## D. Compatibility/dead-code residual

The older `src/modules/employee/onboarding/onboardEmployeeService.js` still contains direct OWNER/MANAGER checks, but the canonical mounted onboarding runtime is `src/modules/employee/onboarding/runtime/...` and already uses `employee.manage` through centralized Position authority.

Disposition: DO NOT treat the old file as live authority without mount evidence. Candidate for dead-code retirement during closure cleanup.

## E. Security surfaces adjacent to, but not automatically part of, Position migration

Fresh archaeology also surfaced master-data routes whose mutation exposure is broader than ideal:
- Brand mutations are authenticated but not capability-gated.
- ProductType mutations are authenticated but not capability-gated.
- Unit currently preserves a public CRUD contract.

These are important security/governance findings but should not be silently mixed into Position migration because their historical contracts and ownership semantics differ.

Disposition: create a separate Master-data Governance/Security batch after the Position-first residual program, unless production evidence raises urgency.

## Recommended remaining execution order

1. Batch 4 — Communication + Store Experience + Product Trace + Legacy Employee Mutation alignment.
2. Product Pricing actor-continuity batch.
3. Fresh global closure scan for remaining live `employeeRole` / `v2Role` / hardcoded business-role checks.
4. Compatibility/dead-code retirement decisions.
5. Separate Master-data Governance/Security agenda for Brand/ProductType/Unit if approved.

This ordering keeps the Position-first migration bounded while preserving evidence for adjacent security work.
