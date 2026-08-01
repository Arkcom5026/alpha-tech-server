# Mission — Sale Return DDWD Server Adoption

## Mission

Adopt the Documentation-Driven Workflow Development Standard (DDWD) for the Sale Return workflow on the Server/repository-authority side.

## Objective

Document the authoritative Sale Return lifecycle from eligibility lookup through item validation, refund/deduction projection, approval, stock restoration, refund evidence, idempotency, history, and downstream document/tax boundaries without overstating behavior not supported by runtime source.

## Runtime Authority Confirmed

- authenticated `branchId` and `employeeId` are canonical actor context;
- eligibility is branch-scoped and starts from the original Sale;
- serialized Sale Items and SIMPLE quantities may be returned;
- returned quantities and refund amounts are validated against remaining eligibility;
- refund channels must equal the approved actual refund;
- deducted refunds require a free-text reason and authorized role;
- authorized deduction roles include OWNER, MANAGER, ADMIN, and SUPER_ADMIN;
- source payment evidence must belong to the original Sale and retain refundable balance;
- stock restoration, stock movement, refund evidence, and completion-command authority execute in one transaction;
- same command identity with the same request is a safe replay; changed material is a conflict;
- concurrent stock or command races require eligibility refresh and retry.

## Canonical and Compatibility Boundary

- canonical Client/runtime path: `/api/sales/returns/...`;
- `/api/sales/returns/create` remains a compatibility completion path inside the canonical router;
- the same router remains mounted at `/api/sale-returns` for legacy callers;
- compatibility retirement is not authorized by this documentation Increment and requires separate usage evidence.

## Implemented Documentation Scope

- Workflow Contract: `docs/workflows/sale-return-workflow-contract.md`
- Acceptance Scenarios: `docs/workflows/sale-return-acceptance-scenarios.md`
- Business Operation Manual: `docs/workflows/sale-return-business-operation-manual.md`
- Operational Evidence Record: `docs/workflows/sale-return-operational-evidence-record.md`
- companion Client Operational User Guide, contextual Help, Focused Contract, and Human Operational Test Pack
- serialized and SIMPLE stock-restoration rules
- refund, source-payment, deduction, and approval boundaries
- idempotency and uncertain-response recovery
- list/detail/history behavior
- Credit Note, tax adjustment, and accounting boundaries recorded without claiming unsupported runtime implementation

## Runtime Impact

Documentation and an evidence-record template only. No API, route, Prisma, migration, refund posting, stock mutation, payment policy, dependency, or production-data behavior change.

## Verification Strategy

- Documentation and Client projection package is complete.
- CI and final certification remain intentionally deferred until final Client and Server SHAs are stable.
- Evidence Record remains `UNEXECUTED` until actual Human Operational Test evidence is supplied.
- Human Operational Test and explicit merge approval remain mandatory acceptance gates.

## Completion Criteria

- [x] Dedicated branch exists.
- [x] Draft PR exists.
- [x] Runtime authority and compatibility boundary are recorded.
- [x] Workflow Contract exists.
- [x] Acceptance Scenarios exist.
- [x] Business Operation Manual exists.
- [x] Operational Evidence Record exists.
- [x] Client projection and in-app guidance are implemented.
- [ ] Focused execution and final certification are recorded.
- [ ] Human Operational Test evidence is recorded.
- [ ] Review and explicit merge decision are recorded.

## Current State

`IN PROGRESS` — repository implementation and documentation package are complete; focused execution, final certification, Human Operational Test, review, and merge remain pending.
