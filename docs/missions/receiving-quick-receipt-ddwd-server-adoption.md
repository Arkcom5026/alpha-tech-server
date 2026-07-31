# Mission — Receiving and Quick Receipt DDWD Server Adoption

## Mission

Adopt the Documentation-Driven Workflow Development Standard (DDWD) for Receiving and Quick Receipt on the Server/repository documentation side.

## Objective

Create an authoritative business and operational guide for receiving without PO, covering both resumable receipt sessions and one-shot completion, so Client in-app guidance remains a curated projection of verified runtime behavior.

## Runtime Authority Under Review

- `src/modules/product/quickStock/services/QuickReceiptSessionService.js`
- `src/modules/product/quickStock/services/QuickReceiptCompleteService.js`
- `src/modules/product/quickStock/controllers/quickReceiptSessionController.js`
- `src/modules/product/quickStock/routes/quickStockRoutes.js`
- inventory receiving policy and repository boundaries
- Quick Receipt migrations and focused contracts

## Planned Scope

- business objective, actors, and responsibilities
- branch/shop isolation
- Supplier and delivery-note identity
- duplicate prevention and normalized delivery-note rules
- resumable session workflow
- one-shot small-delivery workflow
- DRAFT, FINALIZING, COMPLETED, and CANCELLED meanings
- product mode, quantity, barcode, and serial requirements
- idempotency and collision behavior
- tax-document capture boundary
- interrupted-session recovery
- FAQ and troubleshooting
- documentation/runtime evidence boundary

## Documentation Status

- Business manual: planned
- User guide: companion Client adoption increment
- In-app help: companion Client adoption increment
- Workflow Assistant: NOT APPLICABLE in this documentation increment
- Runtime checklist: static operational checklist planned on Client; runtime-backed assistant is follow-up
- FAQ / troubleshooting: planned

## Runtime Impact

Documentation only. No API, Prisma, migration, inventory mutation, route, or production-data change.

## Completion Criteria

- [x] Mission pack exists.
- [ ] Draft PR is opened.
- [ ] Runtime authority review is complete.
- [ ] Receiving and Quick Receipt business operation manual exists.
- [ ] Repository review confirms workflow and authority boundaries.
- [ ] Companion Client projection alignment is recorded.
- [ ] Review and merge decision are recorded.
