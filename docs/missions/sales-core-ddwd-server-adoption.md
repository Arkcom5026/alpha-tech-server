# Mission — Core Sales DDWD Server Adoption

## Mission

Adopt the Documentation-Driven Workflow Development Standard (DDWD) for the Core Sales workflow on the Server/repository documentation side.

## Objective

Create an authoritative business and operational guide for selling from item selection through sale completion, payment or credit settlement, and initial document projection, so Client in-app guidance remains a curated projection of verified runtime behavior.

## Runtime Authority Reviewed

- `src/modules/sales/routes/saleRoutes.js`
- `src/modules/sales/completion/controllers/saleCompletionController.js`
- `src/modules/sales/completion/services/saleCompletionService.js`
- sale completion contract and validator
- payment posting, customer-deposit, stock, and idempotency policies
- Held Cart routes, service, revalidation, and snapshot behavior
- sale history and printable projection
- settlement controller
- mixed structured/SIMPLE/NON_STOCK sale behavior

## Implemented Scope

- business actors and branch/shop authority
- item search and cart preparation
- optional Held Cart snapshot and resume boundary
- structured Stock Items
- tracked SIMPLE products and Simple Lot authority
- NON_STOCK SIMPLE/service-style products
- customer and sale-type rules
- CASH/immediate payment versus CREDIT sale
- payment evidence and outstanding balance
- sale completion transaction and stock mutation
- idempotency and replay-conflict behavior
- default receipt or delivery-note projection
- downstream tax-candidate publication boundary
- printable/history lookup and recovery guidance
- FAQ and troubleshooting
- documentation/runtime evidence boundary
- operational evidence record

## Explicit Exclusion

- Sale Return is not part of this Increment. Return has a separate lifecycle, stock reversal, payment/refund, and evidence boundary and requires a dedicated adoption increment.

## Documentation Status

- Workflow Contract: implemented in `docs/workflows/core-sales-workflow-contract.md`
- Acceptance Scenarios: implemented in `docs/workflows/core-sales-acceptance-scenarios.md`
- Business Operation Manual: implemented in `docs/workflows/core-sales-business-operation-manual.md`
- Operational Evidence Record: implemented in `docs/workflows/core-sales-operational-evidence-record.md`
- Operational User Guide: implemented in companion Client PR #49
- Human Operational Test Pack: implemented in companion Client PR #49
- In-app Help: implemented in companion Client PR #49
- Contextual Help: implemented on the main Sales workflow in companion Client PR #49
- Focused Contract and CI Gate: implemented in companion Client PR #49
- Workflow Assistant: separate scope; not part of this Increment
- Runtime-backed checklist: separate scope; static operational checklist is included in the documentation/help projection
- FAQ / troubleshooting: implemented

## Client Projection Alignment

The Client projection covers the same Core Sales boundaries:

- item and cart preparation;
- structured, tracked SIMPLE, and NON_STOCK lines;
- Held Cart save/resume/revalidation;
- CASH and CREDIT rules;
- payment and deposit evidence;
- idempotency and uncertain-response recovery;
- receipt/delivery-note defaults;
- downstream tax publication and `PENDING_RETRY` recovery without duplicate Sale creation;
- history and printable recovery;
- explicit exclusion of Sale Return.

## Current-head Certification Evidence

- Certified Server SHA: `239c6a41e6a9d6c44584cfeb93886a23801f85c3`
- Server delta from the previously reviewed SHA is one documentation-only file: `docs/workflows/core-sales-operational-evidence-record.md`
- Certified companion Client SHA: `ca7e1a18e36c22eafb3da9191aca7e09fd0f64d7`
- Companion Client GitHub Actions run: `30668830284` — SUCCESS
- Core Sales Help contract: PASS
- Production Build: PASS

## Runtime Impact

Documentation and evidence guidance only. No API, Prisma, migration, stock mutation, payment posting, route, dependency, test-runtime, or production-data change.

## Completion Criteria

- [x] Mission pack exists.
- [x] Draft PR is opened.
- [x] Runtime authority review is complete.
- [x] Workflow Contract exists.
- [x] Acceptance Scenarios exist.
- [x] Core Sales Business Operation Manual exists.
- [x] Operational Evidence Record exists.
- [x] Repository review confirms workflow and authority boundaries.
- [x] Companion Client projection alignment is recorded.
- [x] Current Client and Server SHA certification is recorded.
- [ ] Human Operational Test is executed and recorded.
- [ ] Independent human review is recorded.
- [ ] Explicit merge decision is recorded.

## Current State

`IN PROGRESS` — implementation and current-head repository/CI certification are complete. Human Operational Test, independent human review, and explicit merge approval remain pending. The PR must stay Draft and must not merge until those gates are satisfied.
