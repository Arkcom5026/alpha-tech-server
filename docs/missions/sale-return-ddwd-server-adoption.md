# Mission — Sale Return DDWD Server Adoption

## Mission

Adopt the Documentation-Driven Workflow Development Standard (DDWD) for the Sale Return workflow on the Server/repository-authority side.

## Objective

Document the authoritative Sale Return lifecycle from eligibility lookup through item validation, refund/deduction projection, approval, stock restoration, refund evidence, idempotency, history, and downstream document/tax boundaries without overstating behavior not supported by runtime source.

## Runtime Authority Discovered

- `src/modules/sales/routes/saleRoutes.js`
- `src/modules/sales/return/routes/saleReturnRoutes.js`
- `src/modules/sales/return/controllers/saleReturnController.js`
- `src/modules/sales/return/services/saleReturnService.js`
- `src/modules/sales/return/repositories/saleReturnRepository.js`
- `src/modules/sales/return/validators/saleReturnValidator.js`
- refund, approval, stock, and idempotency policies
- eligibility, refund, and stock-movement builders
- Sale Return history list/detail slices

## Confirmed Runtime Boundaries

- Authenticated `branchId` and `employeeId` are canonical actor context.
- Eligibility is branch-scoped and starts from the original Sale.
- Both serialized Sale Items and SIMPLE quantities may be returned.
- Returned quantities and refund amounts are validated against remaining eligibility.
- Refund channels must equal the actual approved refund amount.
- A refund deduction requires a free-text reason and an authorized role.
- Authorized deduction roles include OWNER, MANAGER, ADMIN, and SUPER_ADMIN.
- Source payment evidence must belong to the original Sale and retain refundable balance.
- Stock restoration, stock movement, refund evidence, and completion-command authority execute in one transaction.
- Reusing the same command identity with the same material request is a safe replay; changed material is a conflict.
- Concurrent stock or command races return a completion conflict and require eligibility refresh.

## Hybrid / Compatibility State Under Assessment

- Canonical nested route: `/sales/returns/...`
- Compatibility completion route: `/sales/returns/create`
- A legacy top-level Client API still targets `/sale-returns/...`.
- Runtime usage must be traced before any compatibility route or legacy Client feature is retired.
- This Mission does not authorize deletion until repository usage and backward-compatibility evidence are complete.

## Planned Documentation Scope

- Workflow Contract
- Acceptance Scenarios
- Business Operation Manual
- refund and deduction authority table
- serialized and SIMPLE stock-restoration rules
- idempotency and uncertain-response recovery
- list/detail/history behavior
- credit note, tax adjustment, and accounting boundary assessment
- Client projection alignment
- Human Operational Test Pack and Operational Evidence Record

## Explicit Exclusions Until Discovery Completes

- No assumption that Credit Note generation is already implemented.
- No assumption that tax adjustment is transactionally coupled to Sale Return.
- No removal of legacy/compatibility API paths.
- No Prisma, migration, runtime behavior, refund posting, or stock policy change in the DDWD documentation phase.

## Verification Strategy

- Continue repository discovery and documentation implementation first.
- Focused contract and CI work are deferred until the implementation package is complete.
- Full certification will run once against final Client and Server SHAs.
- Human Operational Test and explicit merge approval remain mandatory acceptance gates.

## Completion Criteria

- [x] Dedicated branch exists.
- [ ] Draft PR exists.
- [x] Initial runtime authority discovery is recorded.
- [ ] Repository usage of canonical and compatibility paths is resolved.
- [ ] Workflow Contract exists.
- [ ] Acceptance Scenarios exist.
- [ ] Business Operation Manual exists.
- [ ] Client projection and in-app guidance are implemented where appropriate.
- [ ] Focused verification and final certification are recorded.
- [ ] Human Operational Test is recorded.
- [ ] Review and explicit merge decision are recorded.

## Current State

`IN PROGRESS` — runtime discovery has begun; documentation, Client projection, hybrid-state decision, acceptance, and merge remain pending.
