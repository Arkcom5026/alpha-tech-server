# Mission — Core Sales DDWD Server Adoption

## Mission

Adopt the Documentation-Driven Workflow Development Standard (DDWD) for the Core Sales workflow on the Server/repository documentation side.

## Objective

Create an authoritative business and operational guide for selling from item selection through sale completion, payment or credit settlement, and initial document projection, so Client in-app guidance remains a curated projection of verified runtime behavior.

## Runtime Authority Under Review

- `src/modules/sales/routes/saleRoutes.js`
- `src/modules/sales/completion/controllers/saleCompletionController.js`
- `src/modules/sales/completion/services/saleCompletionService.js`
- sale completion validator, payment posting, stock policy, and idempotency policy
- held-cart runtime
- sale history and printable projection
- settlement controller
- mixed structured/simple/non-stock sale behavior

## Planned Scope

- business actors and branch/shop authority
- item search and cart preparation
- optional held-cart snapshot and resume boundary
- structured stock items
- tracked simple products and Simple Lot authority
- non-stock/simple service-style products
- customer and sale-type rules
- cash/immediate payment versus credit sale
- payment evidence and outstanding balance
- sale completion transaction and stock mutation
- idempotency and replay conflict behavior
- default receipt or delivery-note projection
- tax-candidate publication boundary
- printable/history lookup and recovery guidance
- FAQ and troubleshooting
- documentation/runtime evidence boundary

## Explicit Exclusion

- Sale Return is not part of this Increment. Return has a separate lifecycle, stock reversal, payment/refund, and evidence boundary and requires a dedicated adoption increment.

## Documentation Status

- Business manual: planned
- User guide: companion Client adoption increment
- In-app help: companion Client adoption increment
- Contextual Help: appropriate for the main selling workflow and planned on Client
- Workflow Assistant: separate scope; not part of this increment
- Runtime-backed checklist: separate scope; static operational checklist planned on Client
- FAQ / troubleshooting: planned

## Runtime Impact

Documentation only. No API, Prisma, migration, stock mutation, payment posting, route, or production-data change.

## Completion Criteria

- [x] Mission pack exists.
- [ ] Draft PR is opened.
- [ ] Runtime authority review is complete.
- [ ] Core Sales business operation manual exists.
- [ ] Repository review confirms workflow and authority boundaries.
- [ ] Companion Client projection alignment is recorded.
- [ ] Human Operational Test is recorded where applicable.
- [ ] Review and merge decision are recorded.
